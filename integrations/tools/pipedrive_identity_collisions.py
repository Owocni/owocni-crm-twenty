#!/usr/bin/env python3
"""Krok 14: kandydaci kolizji tożsamości PD ↔ Twenty (+ wewnątrz PD).

Buduje listę do ręcznego review (zero auto-merge, zero mintu id_oid):
  - cross_system_email / cross_system_phone  (PD person ↔ Twenty person)
  - pd_internal_email / pd_internal_phone    (2+ PD persons, same contact)
  - cross_system_company_name                (PD org name ↔ Twenty company)

Wyjście w runie stagingu:
  identity/candidates.jsonl
  identity/candidates.csv
  identity/summary.json
  identity/REVIEW.md

Użycie:
  python3 integrations/tools/pipedrive_identity_collisions.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
USER_AGENT = "owocni-pipedrive-identity/1.0"

ROLE_LOCALPARTS = frozenset(
    {
        "biuro",
        "office",
        "kontakt",
        "contact",
        "info",
        "hello",
        "recepcja",
        "admin",
        "sales",
        "sprzedaz",
        "sprzedaż",
        "bok",
        "support",
        "pomoc",
        "marketing",
        "team",
        "hr",
        "rodo",
        "noreply",
        "no-reply",
    }
)


def load_env() -> None:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.is_file():
        raise SystemExit(f"Missing {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def rest_base() -> str:
    return os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")


def headers() -> dict[str, str]:
    key = os.environ.get("TWENTY_API_KEY", "").strip()
    if not key:
        raise SystemExit("Brak TWENTY_API_KEY")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }


def http_json(method: str, path: str, *, retries: int = 8) -> dict:
    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(
            f"{rest_base()}{path}",
            headers=headers(),
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")[:400]
            last_err = RuntimeError(f"{method} {path} → HTTP {e.code}: {err}")
            if e.code == 429:
                wait = min(90.0, 5.0 * (2**attempt))
                print(f"  rate-limit 429 — sleep {wait:.0f}s (attempt {attempt + 1}/{retries})", flush=True)
                time.sleep(wait)
                continue
            raise last_err from e
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2.0 * (attempt + 1))
    raise RuntimeError(f"{method} {path} failed after retries: {last_err}")


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


def load_pd_pages(entity_dir: Path) -> list[dict]:
    rows: list[dict] = []
    for f in sorted(entity_dir.glob("page_*.json")):
        payload = json.loads(f.read_text(encoding="utf-8"))
        rows.extend(payload.get("data") or [])
    return rows


def norm_email(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    e = raw.strip().lower()
    if "@" not in e or " " in e:
        return None
    return e


def is_role_email(email: str) -> bool:
    local = email.split("@", 1)[0]
    local = local.split("+", 1)[0]
    return local in ROLE_LOCALPARTS


def norm_phone(raw: str | None) -> str | None:
    """Normalize to E.164-ish; assume PL (+48) for bare national numbers."""
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s:
        return None
    digits = re.sub(r"[^\d+]", "", s)
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    if digits.startswith("+"):
        body = re.sub(r"\D", "", digits[1:])
        if len(body) < 8:
            return None
        return "+" + body
    body = re.sub(r"\D", "", digits)
    if not body:
        return None
    if body.startswith("48") and len(body) >= 11:
        return "+" + body
    if body.startswith("0") and len(body) >= 9:
        return "+48" + body.lstrip("0")
    if len(body) == 9:
        return "+48" + body
    if len(body) >= 10:
        return "+" + body
    return None


def norm_name(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = unicodedata.normalize("NFKD", raw)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def person_label(p: dict) -> str:
    name = p.get("name")
    if isinstance(name, dict):
        return f"{name.get('firstName') or ''} {name.get('lastName') or ''}".strip() or "(no name)"
    if isinstance(name, str) and name.strip():
        return name.strip()
    return (p.get("name") or p.get("first_name") or "") or "(no name)"


def extract_twenty_emails(p: dict) -> list[str]:
    emails = p.get("emails") or {}
    out: list[str] = []
    if isinstance(emails, dict):
        pe = norm_email(emails.get("primaryEmail"))
        if pe:
            out.append(pe)
        for a in emails.get("additionalEmails") or []:
            ne = norm_email(a if isinstance(a, str) else None)
            if ne and ne not in out:
                out.append(ne)
    elif isinstance(emails, list):
        for item in emails:
            if isinstance(item, dict):
                ne = norm_email(item.get("value") or item.get("email"))
            else:
                ne = norm_email(item if isinstance(item, str) else None)
            if ne and ne not in out:
                out.append(ne)
    return out


def extract_twenty_phones(p: dict) -> list[str]:
    phones = p.get("phones") or {}
    out: list[str] = []
    if isinstance(phones, dict):
        calling = phones.get("primaryPhoneCallingCode") or ""
        number = phones.get("primaryPhoneNumber") or ""
        combined = f"{calling}{number}".strip()
        np = norm_phone(combined) or norm_phone(number)
        if np:
            out.append(np)
        for a in phones.get("additionalPhones") or []:
            if isinstance(a, dict):
                raw = f"{a.get('callingCode') or ''}{a.get('number') or a.get('phoneNumber') or ''}"
                np2 = norm_phone(raw) or norm_phone(a.get("number") or a.get("phoneNumber"))
            else:
                np2 = norm_phone(a if isinstance(a, str) else None)
            if np2 and np2 not in out:
                out.append(np2)
    elif isinstance(phones, list):
        for item in phones:
            if isinstance(item, dict):
                np2 = norm_phone(item.get("value") or item.get("number"))
            else:
                np2 = norm_phone(item if isinstance(item, str) else None)
            if np2 and np2 not in out:
                out.append(np2)
    return out


def extract_pd_emails(p: dict) -> list[str]:
    out: list[str] = []
    for item in p.get("emails") or []:
        if isinstance(item, dict):
            ne = norm_email(item.get("value"))
            if ne and ne not in out:
                out.append(ne)
    return out


def extract_pd_phones(p: dict) -> list[str]:
    out: list[str] = []
    for item in p.get("phones") or []:
        if isinstance(item, dict):
            np = norm_phone(item.get("value"))
            if np and np not in out:
                out.append(np)
    return out


def fetch_all(collection: str, *, cache_path: Path | None = None) -> list[dict]:
    if cache_path and cache_path.is_file():
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        rows = data if isinstance(data, list) else data.get("rows") or []
        print(f"  {collection}: loaded cache {len(rows)} from {cache_path.name}", flush=True)
        return rows

    out: list[dict] = []
    cursor: str | None = None
    while True:
        qs: dict[str, str] = {"limit": "60"}
        if cursor:
            qs["starting_after"] = cursor
        page = http_json("GET", f"/{collection}?" + urllib.parse.urlencode(qs))
        batch = (page.get("data") or {}).get(collection) or []
        out.extend(batch)
        page_info = page.get("pageInfo") or {}
        paging = page.get("paging") or {}
        if page_info.get("hasNextPage"):
            cursor = page_info.get("endCursor")
        elif paging.get("hasNextPage") or paging.get("next_cursor") or paging.get("nextCursor"):
            cursor = paging.get("next_cursor") or paging.get("nextCursor") or paging.get("endCursor")
        else:
            cursor = None
        print(f"  {collection}: {len(out)} …", flush=True)
        if not cursor or len(batch) < 60:
            break
        # Twenty cloud: ~100 req / 60s → ~1.2s spacing keeps headroom
        time.sleep(1.25)
    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(
                {"fetched_at": datetime.now(timezone.utc).isoformat(), "rows": out},
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    return out


def candidate(
    *,
    collision_type: str,
    match_key: str,
    match_value: str,
    pd_side: list[dict],
    twenty_side: list[dict],
    flags: list[str] | None = None,
) -> dict:
    rec = {
        "collision_type": collision_type,
        "match_key": match_key,
        "match_value": match_value,
        "recommended_action": "review",  # link | keep_separate | skip
        "review_status": "pending",
        "resolved_canonical_id": None,
        "flags": flags or [],
        "pd": pd_side,
        "twenty": twenty_side,
        "notes": "",
    }
    if "role_email" in (flags or []):
        rec["recommended_action"] = "keep_separate_likely"
    return rec


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=None)
    parser.add_argument(
        "--refresh-twenty",
        action="store_true",
        help="Pomiń cache people/companies i pobierz na nowo z Twenty",
    )
    args = parser.parse_args()
    run = resolve_run(args.run)
    out_dir = run / "identity"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Run: {run.name}")
    pd_persons_all = load_pd_pages(run / "persons")
    pd_orgs_all = load_pd_pages(run / "organizations")
    pd_persons = [p for p in pd_persons_all if (p.get("_export") or {}).get("in_age_window")]
    pd_orgs = [o for o in pd_orgs_all if (o.get("_export") or {}).get("in_age_window")]
    print(f"PD in-window: persons={len(pd_persons)} orgs={len(pd_orgs)}")

    people_cache = out_dir / "twenty_people_cache.json"
    companies_cache = out_dir / "twenty_companies_cache.json"
    if args.refresh_twenty:
        people_cache.unlink(missing_ok=True)
        companies_cache.unlink(missing_ok=True)

    print("Fetching Twenty people/companies …")
    tw_people = fetch_all("people", cache_path=people_cache)
    tw_companies = fetch_all("companies", cache_path=companies_cache)
    print(f"Twenty: people={len(tw_people)} companies={len(tw_companies)}")

    # --- indexes ---
    pd_by_email: dict[str, list[dict]] = defaultdict(list)
    pd_by_phone: dict[str, list[dict]] = defaultdict(list)
    for p in pd_persons:
        brief = {
            "pd_id": p.get("id"),
            "name": p.get("name"),
            "org_id": p.get("org_id"),
            "emails": extract_pd_emails(p),
            "phones": extract_pd_phones(p),
            "owner": ((p.get("_export") or {}).get("owner_map") or {}).get("pd_name"),
        }
        for e in brief["emails"]:
            pd_by_email[e].append(brief)
        for ph in brief["phones"]:
            pd_by_phone[ph].append(brief)

    tw_by_email: dict[str, list[dict]] = defaultdict(list)
    tw_by_phone: dict[str, list[dict]] = defaultdict(list)
    for p in tw_people:
        emails = extract_twenty_emails(p)
        phones = extract_twenty_phones(p)
        brief = {
            "twenty_id": p.get("id"),
            "name": person_label(p),
            "emails": emails,
            "phones": phones,
            "idOid": p.get("idOid"),
            "pipedriveId": p.get("pipedriveId"),
            "srcSystem": p.get("srcSystem"),
        }
        for e in emails:
            tw_by_email[e].append(brief)
        for ph in phones:
            tw_by_phone[ph].append(brief)

    tw_co_by_name: dict[str, list[dict]] = defaultdict(list)
    for c in tw_companies:
        nn = norm_name(c.get("name"))
        if not nn:
            continue
        tw_co_by_name[nn].append(
            {
                "twenty_id": c.get("id"),
                "name": c.get("name"),
                "domainName": (c.get("domainName") or {}).get("primaryLinkUrl")
                if isinstance(c.get("domainName"), dict)
                else c.get("domainName"),
                "idOid": c.get("idOid"),
                "pipedriveId": c.get("pipedriveId"),
            }
        )

    candidates: list[dict] = []
    seen: set[tuple] = set()

    def add(c: dict) -> None:
        key = (
            c["collision_type"],
            c["match_value"],
            tuple(sorted(str(x.get("pd_id") or x.get("pd_org_id")) for x in c["pd"])),
            tuple(sorted(str(x.get("twenty_id")) for x in c["twenty"])),
        )
        if key in seen:
            return
        seen.add(key)
        candidates.append(c)

    # Internal PD email/phone dups
    for email, rows in pd_by_email.items():
        uniq = {r["pd_id"]: r for r in rows}
        if len(uniq) < 2:
            continue
        flags = ["role_email"] if is_role_email(email) else []
        add(
            candidate(
                collision_type="pd_internal_email",
                match_key="email",
                match_value=email,
                pd_side=list(uniq.values()),
                twenty_side=[],
                flags=flags,
            )
        )

    for phone, rows in pd_by_phone.items():
        uniq = {r["pd_id"]: r for r in rows}
        if len(uniq) < 2:
            continue
        add(
            candidate(
                collision_type="pd_internal_phone",
                match_key="phone",
                match_value=phone,
                pd_side=list(uniq.values()),
                twenty_side=[],
            )
        )

    # Cross-system person
    for email, pd_rows in pd_by_email.items():
        tw_rows = tw_by_email.get(email) or []
        if not tw_rows:
            continue
        flags = ["role_email"] if is_role_email(email) else []
        if any(t.get("idOid") for t in tw_rows):
            flags.append("twenty_has_id_oid")
        add(
            candidate(
                collision_type="cross_system_email",
                match_key="email",
                match_value=email,
                pd_side=list({r["pd_id"]: r for r in pd_rows}.values()),
                twenty_side=list({r["twenty_id"]: r for r in tw_rows}.values()),
                flags=flags,
            )
        )

    for phone, pd_rows in pd_by_phone.items():
        tw_rows = tw_by_phone.get(phone) or []
        if not tw_rows:
            continue
        flags = []
        if any(t.get("idOid") for t in tw_rows):
            flags.append("twenty_has_id_oid")
        add(
            candidate(
                collision_type="cross_system_phone",
                match_key="phone",
                match_value=phone,
                pd_side=list({r["pd_id"]: r for r in pd_rows}.values()),
                twenty_side=list({r["twenty_id"]: r for r in tw_rows}.values()),
                flags=flags,
            )
        )

    # Company name exact (normalized)
    for o in pd_orgs:
        nn = norm_name(o.get("name"))
        if not nn:
            continue
        tw_rows = tw_co_by_name.get(nn) or []
        if not tw_rows:
            continue
        pd_brief = {
            "pd_org_id": o.get("id"),
            "name": o.get("name"),
            "address": o.get("address"),
            "owner": ((o.get("_export") or {}).get("owner_map") or {}).get("pd_name"),
        }
        add(
            candidate(
                collision_type="cross_system_company_name",
                match_key="company_name_norm",
                match_value=nn,
                pd_side=[pd_brief],
                twenty_side=list({r["twenty_id"]: r for r in tw_rows}.values()),
            )
        )

    # Sort: cross-system first, then internals; role emails last within type
    type_order = {
        "cross_system_email": 0,
        "cross_system_phone": 1,
        "cross_system_company_name": 2,
        "pd_internal_email": 3,
        "pd_internal_phone": 4,
    }
    candidates.sort(
        key=lambda c: (
            type_order.get(c["collision_type"], 9),
            1 if "role_email" in c.get("flags", []) else 0,
            c["match_value"],
        )
    )

    # Write jsonl
    jsonl_path = out_dir / "candidates.jsonl"
    with jsonl_path.open("w", encoding="utf-8") as f:
        for c in candidates:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    # CSV for spreadsheet review
    csv_path = out_dir / "candidates.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "collision_type",
                "match_key",
                "match_value",
                "flags",
                "recommended_action",
                "review_status",
                "pd_ids",
                "pd_names",
                "twenty_ids",
                "twenty_names",
                "twenty_id_oids",
                "decision",  # link | keep_separate | skip
                "notes",
            ]
        )
        for c in candidates:
            pd_ids = []
            pd_names = []
            for r in c["pd"]:
                pd_ids.append(str(r.get("pd_id") or r.get("pd_org_id") or ""))
                pd_names.append(str(r.get("name") or ""))
            tw_ids = [str(r.get("twenty_id") or "") for r in c["twenty"]]
            tw_names = [str(r.get("name") or "") for r in c["twenty"]]
            tw_oids = [str(r.get("idOid") or "") for r in c["twenty"]]
            w.writerow(
                [
                    c["collision_type"],
                    c["match_key"],
                    c["match_value"],
                    "|".join(c.get("flags") or []),
                    c["recommended_action"],
                    c["review_status"],
                    "|".join(pd_ids),
                    " || ".join(pd_names),
                    "|".join(tw_ids),
                    " || ".join(tw_names),
                    "|".join(tw_oids),
                    "",
                    "",
                ]
            )

    by_type: dict[str, int] = defaultdict(int)
    role_cross = 0
    with_oid = 0
    for c in candidates:
        by_type[c["collision_type"]] += 1
        if c["collision_type"].startswith("cross_system") and "role_email" in c.get("flags", []):
            role_cross += 1
        if "twenty_has_id_oid" in c.get("flags", []):
            with_oid += 1

    summary = {
        "run_id": run.name,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "pd_persons_in_window": len(pd_persons),
        "pd_orgs_in_window": len(pd_orgs),
        "twenty_people": len(tw_people),
        "twenty_companies": len(tw_companies),
        "candidates_total": len(candidates),
        "by_type": dict(by_type),
        "cross_system_role_email": role_cross,
        "cross_system_with_id_oid": with_oid,
        "policy": "manual review only; zero auto-merge; zero mint id_oid on import",
    }
    (out_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    cross = (
        by_type.get("cross_system_email", 0)
        + by_type.get("cross_system_phone", 0)
        + by_type.get("cross_system_company_name", 0)
    )
    review_md = f"""# Identity collisions — review (`{run.name}`)

Wygenerowano: `{summary["finished_at"]}`

## Polityka

- **Zero auto-merge**, **zero mintu `id_oid`** przy imporcie PD.
- Decyzje w kolumnie `decision` w `candidates.csv`: `link` | `keep_separate` | `skip`.
- `role_email` (biuro@, kontakt@, …) → zwykle `keep_separate` (współdzielona skrzynka).
- Flaga `twenty_has_id_oid`: przy `link` **nie mintuj** nowego oid — użyj istniejącego (T1), ale dopiero po ręcznym GO.

## Liczniki

| Typ | Liczba |
|-----|--------|
| cross_system_email | {by_type.get("cross_system_email", 0)} |
| cross_system_phone | {by_type.get("cross_system_phone", 0)} |
| cross_system_company_name | {by_type.get("cross_system_company_name", 0)} |
| pd_internal_email | {by_type.get("pd_internal_email", 0)} |
| pd_internal_phone | {by_type.get("pd_internal_phone", 0)} |
| **RAZEM** | **{len(candidates)}** |

Cross-system łącznie: **{cross}** (w tym role_email: {role_cross}, z idOid: {with_oid}).

Twenty snapshot: {len(tw_people)} people / {len(tw_companies)} companies.  
PD in-window: {len(pd_persons)} persons / {len(pd_orgs)} orgs.

## Pliki

- `candidates.csv` — do arkusza / ręcznego review
- `candidates.jsonl` — pełne briefy
- `summary.json`

## Jak reviewować (kolejność)

1. `cross_system_email` bez `role_email` — najwyższy priorytet (prawdziwe duplikaty kart).
2. `cross_system_phone` — to samo.
3. `cross_system_company_name` — ostrożnie (nazwa exact; fałszywe trafienia możliwe).
4. `pd_internal_*` — rozstrzygnąć przed loadem albo zaimportować osobno i scalić później w PD-logice review.

Po review: zapisz wypełnione `decision` (osobna kopia CSV OK) — loader użyje mapy linków (osobny krok, nie w tym skrypcie).
"""
    (out_dir / "REVIEW.md").write_text(review_md, encoding="utf-8")

    print("\n=== DONE ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\nArtefakty: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
