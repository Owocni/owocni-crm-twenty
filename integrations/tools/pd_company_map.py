#!/usr/bin/env python3
"""Shared PD → Twenty Company field mapping (Faza 3.0 / 3.1).

DOMAIN_SPARSE path: domain from website OR URL-like name; address/nip usually empty.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"

URL_NAME_RE = re.compile(
    r"(?i)^(?:https?://)?(?:www\.)?([a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)+)/?$"
)
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
# Social / non-company hosts — skip as company domain
SKIP_DOMAINS = frozenset(
    {
        "facebook.com",
        "fb.com",
        "instagram.com",
        "linkedin.com",
        "twitter.com",
        "x.com",
        "youtube.com",
        "tiktok.com",
        "google.com",
        "bit.ly",
        "linktr.ee",
    }
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


def is_junk_name(name: str | None) -> bool:
    s = (name or "").strip().lower()
    return not s or s in JUNK_LABELS


def domain_from_urlish(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s:
        return None
    if "://" not in s and "/" not in s and " " not in s and "." in s:
        m = URL_NAME_RE.match(s)
        if m:
            host = m.group(1).lower()
            return None if host in SKIP_DOMAINS or host in FREE_MAIL else host
    try:
        s2 = s if "://" in s else "https://" + s
        host = (urlparse(s2).hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if host.count(".") >= 1 and " " not in host:
            if host in SKIP_DOMAINS or host in FREE_MAIL:
                return None
            return host
    except Exception:  # noqa: BLE001
        return None
    return None


def is_freemail_org(name: str | None, website: str | None) -> bool:
    for candidate in (website, name):
        d = domain_from_urlish(candidate)
        if d and d in FREE_MAIL:
            return True
        # bare freemail as name
        if candidate and candidate.strip().lower() in FREE_MAIL:
            return True
    return False


def expected_orgs(run: Path) -> list[dict]:
    """Orgs in 3y window, not junk, not freemail."""
    out: list[dict] = []
    for org in load_pages(run / "organizations"):
        if not in_window(org):
            continue
        name = org.get("name")
        website = org.get("website")
        if is_junk_name(name):
            continue
        if is_freemail_org(name, website):
            continue
        out.append(org)
    return out


def map_company_fields(org: dict) -> dict:
    """Twenty create/patch body from PD org (partial OK)."""
    name = (org.get("name") or "").strip() or f"PD org {org.get('id')}"
    website = org.get("website")
    domain = domain_from_urlish(website) or domain_from_urlish(name)
    body: dict = {
        "name": name,
        "pipedriveId": str(org["id"]),
        "idealCustomerProfile": False,
        "position": "last",
    }
    if domain:
        body["domainName"] = {
            "primaryLinkUrl": f"https://{domain}",
            "primaryLinkLabel": domain,
        }
    # address: PD empty in DOMAIN_SPARSE — skip if blank
    addr = org.get("address")
    if isinstance(addr, str) and addr.strip():
        body["address"] = {"addressStreet1": addr.strip()[:500]}
    elif isinstance(addr, dict):
        street = (addr.get("value") or addr.get("street_number") or "").strip()
        city = (addr.get("locality") or addr.get("city") or "").strip()
        if street or city:
            body["address"] = {
                "addressStreet1": street[:500] if street else None,
                "addressCity": city[:200] if city else None,
                "addressCountry": (addr.get("country") or "").strip()[:100] or None,
                "addressPostcode": (addr.get("postal_code") or "").strip()[:32] or None,
            }
    return body


def display_name_from_domain(domain: str) -> str:
    """flexipowergroup.pl → Flexipowergroup"""
    label = domain.split(".")[0]
    return label[:1].upper() + label[1:] if label else domain
