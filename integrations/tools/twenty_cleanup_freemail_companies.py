#!/usr/bin/env python3
"""Usuń Companies utworzone z domen free-mail (Email Sync bez exclude non-professional).

Użycie:
  python3 integrations/tools/twenty_cleanup_freemail_companies.py --dry-run
  python3 integrations/tools/twenty_cleanup_freemail_companies.py --dry-run --mode broad
  python3 integrations/tools/twenty_cleanup_freemail_companies.py --apply

Tryby:
  safe  (domyślny) — usuń gdy name == domain i is_free_mail (np. onet.pl / onet.pl)
  broad — usuń każdą firmę z domeną free-mail (ryzyko: Orange Polska @ orange.pl)

SSOT listy: owocni-crm/data/free_mail_domains_v1.json (exact match — BEZ substring)
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "integrations" / "shared"))
from is_free_mail import is_free_mail as is_free_mail_ssot  # noqa: E402

FREE_MAIL_JSON = REPO_ROOT / "integrations" / "shared" / "data" / "free_mail_domains_v1.json"
if not FREE_MAIL_JSON.exists():
    FREE_MAIL_JSON = REPO_ROOT / "owocni-crm" / "data" / "free_mail_domains_v1.json"
USER_AGENT = "owocni-crm-twenty-freemail-cleanup/1.0"


def load_dotenv_local() -> None:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def is_free_mail(domain_reg: str, rules: dict | None = None) -> bool:
    """Exact match SSOT v1 — never substring."""
    return is_free_mail_ssot(domain_reg, json_path=str(FREE_MAIL_JSON))


def domain_from_company(company: dict) -> str:
    url = (company.get("domainName") or {}).get("primaryLinkUrl") or ""
    d = url.replace("https://", "").replace("http://", "").strip("/").lower()
    if d:
        return d
    name = (company.get("name") or "").strip().lower()
    if re.match(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$", name):
        return name
    return ""


def company_matches(company: dict, mode: str) -> tuple[bool, str]:
    domain = domain_from_company(company)
    if not domain or not is_free_mail(domain):
        return False, domain
    name = (company.get("name") or "").strip().lower()
    if mode == "broad":
        return True, domain
    if name == domain or name.replace("www.", "") == domain:
        return True, domain
    return False, domain


def rest_base() -> str:
    return os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")


def api_headers() -> dict[str, str]:
    token = os.environ.get("TWENTY_API_KEY", "").strip()
    if not token:
        print("Błąd: brak TWENTY_API_KEY w .env.local", file=sys.stderr)
        sys.exit(2)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }


def http_json(method: str, url: str, body: dict | None = None, retries: int = 10) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=api_headers(), method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 502, 503) and attempt + 1 < retries:
                wait = min(90, 5 * (attempt + 1))
                print(f"  retry {method} {e.code} wait={wait}s (attempt {attempt+1})", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
    assert last_err is not None
    raise last_err


def fetch_all_companies() -> list[dict]:
    items: list[dict] = []
    cursor: str | None = None
    while True:
        url = f"{rest_base()}/companies?limit=20"
        if cursor:
            url += f"&starting_after={cursor}"
        payload = http_json("GET", url)
        items.extend(payload.get("data", {}).get("companies", []))
        page = payload.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")
        if not cursor:
            break
        time.sleep(1.5)
    return items


def list_people_for_company(company_id: str) -> list[dict]:
    filt = f"companyId[eq]:{company_id}"
    url = f"{rest_base()}/people?filter={urllib.parse.quote(filt)}&limit=60"
    payload = http_json("GET", url)
    return payload.get("data", {}).get("people", []) or []


def unlink_person(person_id: str) -> bool:
    url = f"{rest_base()}/people/{person_id}"
    try:
        http_json("PATCH", url, {"companyId": None})
        return True
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")[:200]
        print(f"  FAIL UNLINK person {person_id}: {e.code} {err}", file=sys.stderr)
        return False


def delete_company(company_id: str) -> bool:
    url = f"{rest_base()}/companies/{company_id}"
    try:
        http_json("DELETE", url)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        print(f"  FAIL DELETE {company_id}: {e.code} {body}", file=sys.stderr)
        return False


def purge_company(company: dict) -> bool:
    company_id = company["id"]
    people = list_people_for_company(company_id)
    for person in people:
        pid = person.get("id")
        if pid:
            unlink_person(pid)
    return delete_company(company_id)


def main() -> None:
    load_dotenv_local()
    apply = "--apply" in sys.argv
    dry = "--dry-run" in sys.argv or not apply
    mode = "safe"
    if "--mode" in sys.argv:
        idx = sys.argv.index("--mode")
        if idx + 1 < len(sys.argv):
            mode = sys.argv[idx + 1].strip().lower()
    if mode not in ("safe", "broad"):
        print("Tryb: --mode safe | broad", file=sys.stderr)
        sys.exit(1)
    if not dry and not apply:
        print("Podaj --dry-run lub --apply", file=sys.stderr)
        sys.exit(1)

    companies = fetch_all_companies()
    targets: list[tuple[dict, str]] = []
    for company in companies:
        ok, domain = company_matches(company, mode)
        if ok:
            targets.append((company, domain))

    print(
        f"Twenty free-mail companies cleanup ({'APPLY' if apply else 'DRY-RUN'}) "
        f"mode={mode} @ {rest_base()}"
    )
    print(f"SSOT: {FREE_MAIL_JSON.name} (exact match, no substring)")
    print(f"Companies total: {len(companies)}")
    print(f"To delete: {len(targets)}")
    print()

    for company, domain in sorted(targets, key=lambda x: x[1]):
        name = company.get("name", "")
        src = (company.get("createdBy") or {}).get("source", "?")
        print(f"  {domain:24} | {name[:40]:40} | {src:8} | {company['id']}")

    if not targets:
        print("\nNic do usunięcia.")
        return

    if dry:
        print(f"\nUruchom z --apply aby usunąć {len(targets)} firm.")
        if mode == "safe":
            print("Tip: --mode broad usuwa też firmy typu „Orange Polska” @ orange.pl — ostrożnie.")
        return

    deleted = 0
    failed = 0
    for i, (company, _domain) in enumerate(targets, 1):
        if purge_company(company):
            deleted += 1
        else:
            failed += 1
        if i % 5 == 0:
            time.sleep(0.3)

    print(f"\nUsunięto: {deleted}, błędy: {failed}")
    if failed:
        print(
            "Twenty może blokować DELETE gdy są otwarte Opportunity — "
            "odłącz w UI i powtórz."
        )


if __name__ == "__main__":
    main()
