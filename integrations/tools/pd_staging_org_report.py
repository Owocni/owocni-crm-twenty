#!/usr/bin/env python3
"""Faza 1 — raport wypełnienia pól organizacji/osób w stagingu Pipedrive.

Dekoduje organizationFields / personFields, liczy fill-rate (NIP, WWW, adres,
email, telefon) w oknie 3 lat. Dodatkowo: WWW wyciągnięte z nazwy-URL.

Użycie:
  python3 integrations/tools/pd_staging_org_report.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"

URL_NAME_RE = re.compile(
    r"(?i)^(?:https?://)?(?:www\.)?([a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)+)/?$"
)
NIP_RE = re.compile(r"\b\d{10}\b")
FREE_MAIL = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "wp.pl",
        "onet.pl",
        "interia.pl",
        "o2.pl",
        "op.pl",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "icloud.com",
        "me.com",
        "proton.me",
        "protonmail.com",
    }
)
JUNK_LABELS = frozenset(
    {"brak", "dobra opinia", "lead", "(no title)", "untitled", "undefined", "n/a", "na", "-", "—", "."}
)


def resolve_run(run_id: str | None) -> Path:
    if run_id:
        path = RUNS / run_id
        if not path.is_dir():
            raise SystemExit(f"Brak runu {path}")
        return path
    runs = sorted([p for p in RUNS.iterdir() if p.is_dir()], reverse=True)
    if not runs:
        raise SystemExit("Brak runów")
    return runs[0]


def load_pages(entity_dir: Path) -> list[dict]:
    rows: list[dict] = []
    for f in sorted(entity_dir.glob("page_*.json")):
        rows.extend(json.loads(f.read_text(encoding="utf-8")).get("data") or [])
    return rows


def in_window(row: dict) -> bool:
    return bool((row.get("_export") or {}).get("in_age_window"))


def domain_from_urlish(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s:
        return None
    if "://" not in s and "/" not in s and " " not in s and "." in s:
        m = URL_NAME_RE.match(s)
        if m:
            return m.group(1).lower()
    try:
        if "://" not in s:
            s2 = "https://" + s
        else:
            s2 = s
        host = (urlparse(s2).hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if host.count(".") >= 1 and " " not in host:
            return host
    except Exception:  # noqa: BLE001
        return None
    return None


def is_junk_name(name: str | None) -> bool:
    s = (name or "").strip().lower()
    return not s or s in JUNK_LABELS


def is_freemail_org(name: str | None, website: str | None) -> bool:
    for candidate in (website, name):
        d = domain_from_urlish(candidate)
        if d and d in FREE_MAIL:
            return True
    return False


def field_index(meta_path: Path) -> dict[str, dict]:
    if not meta_path.is_file():
        return {}
    data = json.loads(meta_path.read_text(encoding="utf-8")).get("data") or []
    return {f.get("key"): f for f in data if f.get("key")}


def nonempty(v) -> bool:
    if v is None or v == "" or v == [] or v == {}:
        return False
    if isinstance(v, dict) and not any(nonempty(x) for x in v.values()):
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=None)
    args = parser.parse_args()
    run = resolve_run(args.run)
    out_dir = run / "repair"
    out_dir.mkdir(parents=True, exist_ok=True)

    org_meta = field_index(run / "meta" / "organizationFields.json")
    person_meta = field_index(run / "meta" / "personFields.json")
    orgs = [o for o in load_pages(run / "organizations") if in_window(o)]
    persons = [p for p in load_pages(run / "persons") if in_window(p)]

    # --- organizations ---
    org_stats = {
        "in_window": len(orgs),
        "junk_name": 0,
        "freemail_guess": 0,
        "with_website_field": 0,
        "with_address_any": 0,
        "with_linkedin": 0,
        "with_industry": 0,
        "name_looks_like_url": 0,
        "domain_from_name": 0,
        "custom_nonempty_by_key": Counter(),
        "nip_candidates": 0,
    }
    url_name_samples: list[dict] = []
    for o in orgs:
        name = o.get("name")
        if is_junk_name(name):
            org_stats["junk_name"] += 1
        website = o.get("website")
        if nonempty(website):
            org_stats["with_website_field"] += 1
        addr = o.get("address") or o.get("address_formatted_address")
        if nonempty(addr) or any(
            nonempty(o.get(k)) for k in o if str(k).startswith("address_")
        ):
            org_stats["with_address_any"] += 1
        if nonempty(o.get("linkedin")):
            org_stats["with_linkedin"] += 1
        if nonempty(o.get("industry")):
            org_stats["with_industry"] += 1
        d_from_name = domain_from_urlish(name if isinstance(name, str) else None)
        if d_from_name:
            org_stats["name_looks_like_url"] += 1
            org_stats["domain_from_name"] += 1
            if len(url_name_samples) < 15:
                url_name_samples.append(
                    {"id": o.get("id"), "name": name, "domain": d_from_name}
                )
        if is_freemail_org(name, website if isinstance(website, str) else None):
            org_stats["freemail_guess"] += 1
        for k, v in (o.get("custom_fields") or {}).items():
            if nonempty(v):
                org_stats["custom_nonempty_by_key"][k] += 1
                blob = str(v)
                if NIP_RE.search(blob.replace(" ", "")):
                    org_stats["nip_candidates"] += 1
        # also scan top-level hash-like keys
        for k, v in o.items():
            if re.fullmatch(r"[0-9a-f]{40}", str(k) or "") and nonempty(v):
                org_stats["custom_nonempty_by_key"][k] += 1

    expected_companies = (
        org_stats["in_window"] - org_stats["junk_name"] - org_stats["freemail_guess"]
    )

    # --- persons ---
    person_stats = {
        "in_window": len(persons),
        "with_email": 0,
        "with_phone": 0,
        "with_org_id": 0,
        "no_contact": 0,
        "custom_nonempty_by_key": Counter(),
    }
    for p in persons:
        emails = p.get("emails") or []
        phones = p.get("phones") or []
        has_e = any(nonempty((e or {}).get("value")) for e in emails)
        has_p = any(nonempty((ph or {}).get("value")) for ph in phones)
        if has_e:
            person_stats["with_email"] += 1
        if has_p:
            person_stats["with_phone"] += 1
        if not has_e and not has_p:
            person_stats["no_contact"] += 1
        if p.get("org_id"):
            person_stats["with_org_id"] += 1
        for k, v in (p.get("custom_fields") or {}).items():
            if nonempty(v):
                person_stats["custom_nonempty_by_key"][k] += 1

    # gate recommendation
    www_rate = org_stats["with_website_field"] / max(1, org_stats["in_window"])
    nip_rate = org_stats["nip_candidates"] / max(1, org_stats["in_window"])
    domain_name_rate = org_stats["domain_from_name"] / max(1, org_stats["in_window"])
    if nip_rate >= 0.30:
        path = "NIP_ENRICHMENT"
        path_note = "NIP ≥30% → Faza 3 ścieżka enrichment (MF/KRS)."
    elif www_rate >= 0.30 or domain_name_rate >= 0.20:
        path = "DOMAIN"
        path_note = (
            "Brak NIP; WWW/nazwa-URL dostępne → Faza 3 ścieżka domenowa "
            "(domainName z website lub z name-URL)."
        )
    else:
        path = "DOMAIN_SPARSE"
        path_note = (
            "Org w PD prawie bez WWW/adresu/NIP. Backfill firm: domainName z nazw-URL "
            "gdzie da się; reszta bez domeny. Osoby/emaile są główną wartością kontaktu."
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run.name,
        "gate": {
            "path": path,
            "note": path_note,
            "www_field_rate": round(www_rate, 4),
            "nip_candidate_rate": round(nip_rate, 4),
            "domain_from_name_rate": round(domain_name_rate, 4),
        },
        "organization_fields_meta": [
            {
                "key": k,
                "name": f.get("name"),
                "field_type": f.get("field_type"),
                "edit_flag": f.get("edit_flag"),
            }
            for k, f in org_meta.items()
        ],
        "person_fields_meta_custom_or_notable": [
            {
                "key": k,
                "name": f.get("name"),
                "field_type": f.get("field_type"),
                "edit_flag": f.get("edit_flag"),
            }
            for k, f in person_meta.items()
            if f.get("edit_flag")
            or any(
                x in (f.get("name") or "").lower()
                for x in ("nip", "stanow", "firma", "www", "adres")
            )
        ],
        "organizations": {
            **{k: v for k, v in org_stats.items() if k != "custom_nonempty_by_key"},
            "custom_nonempty_by_key": {
                (org_meta.get(k, {}).get("name") or k): c
                for k, c in org_stats["custom_nonempty_by_key"].most_common(30)
            },
            "expected_in_twenty_after_exclusions": expected_companies,
            "url_name_samples": url_name_samples,
        },
        "persons": {
            **{k: v for k, v in person_stats.items() if k != "custom_nonempty_by_key"},
            "email_rate": round(
                person_stats["with_email"] / max(1, person_stats["in_window"]), 4
            ),
            "phone_rate": round(
                person_stats["with_phone"] / max(1, person_stats["in_window"]), 4
            ),
            "custom_nonempty_by_key": {
                (person_meta.get(k, {}).get("name") or k): c
                for k, c in person_stats["custom_nonempty_by_key"].most_common(30)
            },
        },
        "live_api_spotcheck_note": (
            "2026-08-13: live PD /v1/organizations sample 500 → website=0 address=0; "
            "organizationFields bez custom NIP (tylko standardowe website/address). "
            "Staging odzwierciedla rzeczywistość PD, nie ubytek eksportu."
        ),
    }

    (out_dir / "org_report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    md = [
        f"# PD staging org/person report — `{run.name}`",
        "",
        f"Wygenerowano: {report['generated_at']}",
        "",
        "## GATE (Faza 1.2)",
        "",
        f"**Ścieżka Fazy 3:** `{path}`",
        "",
        path_note,
        "",
        f"- WWW field rate: **{www_rate:.1%}**",
        f"- NIP candidate rate: **{nip_rate:.1%}**",
        f"- Domain-from-name rate: **{domain_name_rate:.1%}**",
        "",
        "## Organizacje (okno 3 lat)",
        "",
        f"| Metryka | Wartość |",
        f"|---|---:|",
        f"| In window | {org_stats['in_window']} |",
        f"| Junk name | {org_stats['junk_name']} |",
        f"| Freemail guess | {org_stats['freemail_guess']} |",
        f"| Oczekiwane w Twenty (po wykluczeniach) | {expected_companies} |",
        f"| `website` field filled | {org_stats['with_website_field']} |",
        f"| address any | {org_stats['with_address_any']} |",
        f"| name wygląda jak URL → domain | {org_stats['domain_from_name']} |",
        "",
        "## Osoby (okno 3 lat)",
        "",
        f"| Metryka | Wartość |",
        f"|---|---:|",
        f"| In window | {person_stats['in_window']} |",
        f"| Z e-mailem | {person_stats['with_email']} ({person_stats['with_email']/max(1,person_stats['in_window']):.1%}) |",
        f"| Z telefonem | {person_stats['with_phone']} ({person_stats['with_phone']/max(1,person_stats['in_window']):.1%}) |",
        f"| Bez kontaktu | {person_stats['no_contact']} |",
        f"| Z `org_id` | {person_stats['with_org_id']} |",
        "",
        "## Uwaga live API",
        "",
        report["live_api_spotcheck_note"],
        "",
        "## Sample nazw-URL → domena",
        "",
    ]
    for s in url_name_samples:
        md.append(f"- `{s['id']}` {s['name']!r} → `{s['domain']}`")
    md.append("")

    (out_dir / "ORG_REPORT.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))
    print(f"\nArtefacts: {out_dir}/ORG_REPORT.md , org_report.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
