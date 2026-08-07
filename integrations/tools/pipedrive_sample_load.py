#!/usr/bin/env python3
"""Sample load Pipedrive → Twenty (krok 16).

Ładuje N deali z stagingu (domyślnie 15) + powiązane Person/Company.
- srcSystem=PIPEDRIVE_LEGACY, bizSource=PIPEDRIVE_IMPORT, pipedriveId
- createdAt=add_time, legacyCreatedAt, legacyPipedriveStageName
- idOid NIE ustawiane (zero mint)
- identity: decision=link → reuse Twenty person (bez nowego idOid na opp)
- mailbox note (krótka) jeśli draft istnieje

Użycie:
  python3 integrations/tools/pipedrive_sample_load.py --run 20260804T065324Z --limit 15
  python3 integrations/tools/pipedrive_sample_load.py --dry-run
  python3 integrations/tools/pipedrive_sample_load.py --backfill
  python3 integrations/tools/pipedrive_sample_load.py --full   # całość okna 3 lat (~3251)
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
USER_AGENT = "owocni-pipedrive-sample-load/1.0"

STAGE_BY_ID: dict[int, str] = {
    1: "NEW",
    2: "QUALIFIED",
    3: "PROPOSAL",
    4: "CONTRACT_SENT",
    6: "NEW",
    7: "CONTACTED",
    8: "PROPOSAL",
    9: "CONTRACT_SENT",
    10: "NEW",
    11: "PROPOSAL",
    12: "CONTRACT_SENT",
    18: "PAYING",
    19: "CONTACTED",
    20: "PROPOSAL",
    21: "CONTRACT_SENT",
}

# Pipedrive custom: deklarowany budżet
PD_BUDGET_FIELD_KEY = "9af98a4bcc0bde0fc209bf662ca8773d26ef2451"
BUDGET_RANGE_PLN: dict[str, tuple[float | None, float | None]] = {
    "0 - 2.000 zł": (0, 2000),
    "2.000 - 5.000 zł": (2000, 5000),
    "5.000 - 10.000 zł": (5000, 10000),
    "5.000 - 15.000 zł": (5000, 15000),
    "10.000 - 25.000 zł": (10000, 25000),
    "25.000 - 100.000 zł": (25000, 100000),
    "100.000 - 1.000.000 zł": (100000, 1000000),
    "Powyżej miliona złotych": (1000000, None),
}


def money(n: float, currency: str = "PLN") -> dict:
    return {"amountMicros": int(round(float(n) * 1_000_000)), "currencyCode": currency}


def display_amount(n: float, currency: str = "PLN") -> str:
    num = int(round(float(n)))
    return f"{num:,}".replace(",", " ") + f" {currency}"


def apply_value_fields(opp_body: dict, deal: dict, stage: str) -> None:
    """amount / bizValueDisplay / bizValueWon / widełki z deklarowanego budżetu / lossDescription."""
    currency = deal.get("currency") or "PLN"
    value = deal.get("value") or 0
    budget = (deal.get("custom_fields") or {}).get(PD_BUDGET_FIELD_KEY)
    if budget in (None, "", "undefined"):
        budget = None

    if isinstance(value, (int, float)) and float(value) > 0:
        amt = money(float(value), currency)
        opp_body["amount"] = amt
        opp_body["bizValueDisplay"] = display_amount(float(value), currency)
        if stage == "WON":
            opp_body["bizValueWon"] = amt
    elif budget:
        opp_body["bizValueDisplay"] = str(budget)
        rng = BUDGET_RANGE_PLN.get(str(budget).strip())
        if rng:
            lo, hi = rng
            if lo is not None and lo > 0:
                opp_body["bizValueMin"] = money(lo, "PLN")
            if hi is not None:
                opp_body["bizValueMax"] = money(hi, "PLN")
    else:
        # Match live Sortownia card: always show a value label
        opp_body["bizValueDisplay"] = f"0 {currency}"

    if stage == "LOST" and deal.get("lost_reason"):
        opp_body["lossDescription"] = str(deal["lost_reason"])[:2000]


JUNK_LABELS = frozenset(
    {
        "brak",
        "dobra opinia",
        "lead",
        "(no title)",
        "untitled",
        "undefined",
        "n/a",
        "na",
        "-",
        "—",
        ".",
    }
)


def clean_label(raw: str | None) -> str:
    s = (raw or "").replace("\xa0", " ").strip()
    return re.sub(r"\s+", " ", s)


def is_junk_label(raw: str | None) -> bool:
    s = clean_label(raw).lower()
    return not s or s in JUNK_LABELS


def person_display_name(person: dict | None, emails: list[str] | None = None) -> str | None:
    name = clean_label((person or {}).get("name"))
    if name and not is_junk_label(name):
        return name
    if emails:
        return emails[0]
    return name or None


def compose_opportunity_name(
    deal: dict,
    person: dict | None,
    org: dict | None,
    emails: list[str] | None = None,
) -> str:
    """Prefer PD title; for junk titles fall back to person / org (never append junk org)."""
    title = clean_label(deal.get("title"))
    did = int(deal["id"])
    if not is_junk_label(title):
        return title[:512]
    pname = person_display_name(person, emails)
    oname = clean_label((org or {}).get("name"))
    if oname and not is_junk_label(oname):
        if pname and fold_pl(pname) not in fold_pl(oname):
            return f"{pname} — {oname}"[:512]
        return (pname or oname)[:512]
    if pname:
        return pname[:512]
    return f"PD deal {did}"


def usable_org(org: dict | None) -> bool:
    return bool(org) and not is_junk_label(org.get("name"))


def parse_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    s = str(raw).strip().replace(" ", "T")
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        s = s + "T12:00:00+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def biz_last_contact_label(dt: datetime, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    hours = max(0, int((now - dt).total_seconds() // 3600))
    if hours < 24:
        return f"Godzin: {hours}"
    return f"Dni: {hours // 24}"


def resolve_last_contact_at(
    run: Path,
    deal: dict,
    *,
    activities_by_deal: dict[int, list[dict]] | None = None,
    notes_by_deal: dict[int, list[dict]] | None = None,
) -> tuple[str, datetime] | tuple[None, None]:
    """Źródła (kolejność): mail PD → done activity → note → deal add_time.

    Nie używamy deal.update_time (często bulk / sztuczny bump).
    """
    deal_id = int(deal["id"])
    buckets: dict[str, list[datetime]] = {
        "mail": [],
        "activity": [],
        "note": [],
        "deal_add": [],
    }
    mp = run / "mailbox" / f"deal_{deal_id}.json"
    if mp.is_file():
        for m in json.loads(mp.read_text(encoding="utf-8")).get("messages") or []:
            dt = parse_dt(m.get("message_time"))
            if dt:
                buckets["mail"].append(dt)
    for a in (activities_by_deal or {}).get(deal_id, []):
        if not a.get("done"):
            continue
        dt = parse_dt(a.get("marked_as_done_time") or a.get("update_time"))
        if dt:
            buckets["activity"].append(dt)
    for n in (notes_by_deal or {}).get(deal_id, []):
        dt = parse_dt(n.get("add_time"))
        if dt:
            buckets["note"].append(dt)
    dt = parse_dt(deal.get("add_time"))
    if dt:
        buckets["deal_add"].append(dt)
    for src in ("mail", "activity", "note", "deal_add"):
        if buckets[src]:
            return src, max(buckets[src])
    return None, None


def apply_last_contact_fields(
    opp_body: dict,
    run: Path,
    deal: dict,
    *,
    activities_by_deal: dict[int, list[dict]] | None = None,
    notes_by_deal: dict[int, list[dict]] | None = None,
) -> None:
    src, dt = resolve_last_contact_at(
        run,
        deal,
        activities_by_deal=activities_by_deal,
        notes_by_deal=notes_by_deal,
    )
    if not dt:
        return
    opp_body["lastContactAt"] = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    opp_body["bizLastContactLabel"] = biz_last_contact_label(dt)


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


def http_json(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    for attempt in range(8):
        req = urllib.request.Request(
            f"{rest_base()}{path}",
            data=data,
            headers=headers(),
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                raw = res.read().decode("utf-8")
                return res.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            if e.code == 429:
                time.sleep(min(60.0, 5.0 * (2**attempt)))
                continue
            return e.code, {"error": err[:600]}
    return 429, {"error": "rate limit retries exhausted"}


def extract_created_id(collection: str, payload: dict) -> str | None:
    data = payload.get("data") or {}
    # REST sometimes: data.people / data.createPerson
    singular = collection.rstrip("s")
    for key in (
        collection,
        singular,
        f"create{singular[:1].upper()}{singular[1:]}",
        f"create{collection[:1].upper()}{collection[1:]}",
    ):
        node = data.get(key)
        if isinstance(node, dict) and node.get("id"):
            return node["id"]
        if isinstance(node, list) and node and isinstance(node[0], dict):
            return node[0].get("id")
    # camel createOpportunity / createPerson
    for k, v in data.items():
        if isinstance(v, dict) and v.get("id") and k.lower().startswith("create"):
            return v["id"]
    return data.get("id")


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


def index_by_id(rows: list[dict]) -> dict[int, dict]:
    out: dict[int, dict] = {}
    for r in rows:
        rid = r.get("id")
        if rid is not None:
            out[int(rid)] = r
    return out


def fold_pl(s: str) -> str:
    repl = str.maketrans(
        {
            "ą": "a",
            "ć": "c",
            "ę": "e",
            "ł": "l",
            "ń": "n",
            "ó": "o",
            "ś": "s",
            "ź": "z",
            "ż": "z",
            "Ą": "a",
            "Ć": "c",
            "Ę": "e",
            "Ł": "l",
            "Ń": "n",
            "Ó": "o",
            "Ś": "s",
            "Ź": "z",
            "Ż": "z",
        }
    )
    s = (s or "").translate(repl)
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def norm_email(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    e = raw.strip().lower()
    if e.count("@") != 1:
        return None
    local, _, domain = e.partition("@")
    if not local or not domain or "." not in domain or " " in e:
        return None
    return e


def norm_phone(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    digits = re.sub(r"[^\d+]", "", raw.strip())
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    if digits.startswith("+"):
        body = re.sub(r"\D", "", digits[1:])
        return ("+" + body) if len(body) >= 8 else None
    body = re.sub(r"\D", "", digits)
    if not body:
        return None
    if body.startswith("48") and len(body) >= 11:
        return "+" + body
    if body.startswith("0") and len(body) >= 9:
        return "+48" + body.lstrip("0")
    if len(body) == 9:
        return "+48" + body
    return ("+" + body) if len(body) >= 10 else None


# ITU-T calling codes Twenty accepts for phones (subset + PL focus)
_KNOWN_CALLING = frozenset(
    {
        "+1",
        "+7",
        "+33",
        "+34",
        "+39",
        "+44",
        "+48",
        "+49",
        "+31",
        "+32",
        "+36",
        "+40",
        "+41",
        "+43",
        "+45",
        "+46",
        "+47",
        "+351",
        "+352",
        "+353",
        "+358",
        "+370",
        "+371",
        "+372",
        "+380",
        "+420",
        "+421",
        "+90",
        "+971",
        "+972",
    }
)


def phone_payload(e164: str | None) -> dict | None:
    """Build Twenty phones object; skip garbage / unknown calling codes."""
    if not e164 or not e164.startswith("+"):
        return None
    body = e164[1:]
    if not body.isdigit() or len(body) < 8:
        return None
    # Prefer longest matching known calling code
    code = None
    for n in (4, 3, 2, 1):
        cand = "+" + body[:n]
        if cand in _KNOWN_CALLING and len(body) > n:
            code = cand
            national = body[n:]
            break
    if not code:
        # Default PL if looks like PL national after bad prefix
        if len(body) == 9:
            code, national = "+48", body
        elif body.startswith("48") and len(body) >= 11:
            code, national = "+48", body[2:]
        else:
            return None
    if not national or not national.isdigit():
        return None
    country = "PL" if code == "+48" else ""
    out = {
        "primaryPhoneCallingCode": code,
        "primaryPhoneNumber": national,
    }
    if country:
        out["primaryPhoneCountryCode"] = country
    return out


def split_name(full: str) -> dict[str, str]:
    parts = [p for p in (full or "").strip().split() if p]
    if not parts:
        return {"firstName": "Unknown", "lastName": "Pipedrive"}
    if len(parts) == 1:
        return {"firstName": parts[0], "lastName": ""}
    return {"firstName": parts[0], "lastName": " ".join(parts[1:])}


def map_stage(deal: dict, stage_names: dict[int, str]) -> tuple[str, str]:
    status = (deal.get("status") or "").lower()
    sid = int(deal.get("stage_id") or 0)
    legacy = stage_names.get(sid, f"stage_id={sid}")
    if status == "won":
        return "WON", legacy
    if status == "lost":
        return "LOST", legacy
    return STAGE_BY_ID.get(sid, "NEW"), legacy


def load_identity_links(run: Path) -> dict[int, dict]:
    """pd_person_id → {twenty_id, email, idOid?} for decision=link."""
    path = run / "identity" / "candidates.csv"
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8-sig")
    delim = "\t" if text.splitlines()[0].count("\t") > text.splitlines()[0].count(",") else ","
    links: dict[int, dict] = {}
    for r in csv.DictReader(text.splitlines(), delimiter=delim):
        if (r.get("decision") or "").strip() != "link":
            continue
        if r.get("collision_type") not in ("cross_system_email", "cross_system_phone"):
            continue
        tw_ids = [x for x in (r.get("twenty_ids") or "").split("|") if x]
        if not tw_ids:
            continue
        oids = [x for x in (r.get("twenty_id_oids") or "").split("|") if x]
        for pid in (r.get("pd_ids") or "").split("|"):
            pid = pid.strip()
            if not pid.isdigit():
                continue
            links[int(pid)] = {
                "twenty_id": tw_ids[0],
                "email": r.get("match_value"),
                "idOid": oids[0] if oids else None,
                "collision_type": r.get("collision_type"),
            }
    return links


def load_bizproduct(run: Path) -> dict[int, str | None]:
    path = run / "products" / "bizproduct_map.jsonl"
    out: dict[int, str | None] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        o = json.loads(line)
        did = o.get("deal_id")
        if did is not None:
            out[int(did)] = o.get("bizProduct")
    return out


def load_mailbox_notes(run: Path) -> dict[int, str]:
    path = run / "mailbox" / "note_drafts.jsonl"
    out: dict[int, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        o = json.loads(line)
        did = o.get("deal_id")
        body = o.get("body") or o.get("note") or o.get("text")
        if did is not None and body:
            out[int(did)] = str(body)[:4000]
    return out


def is_free_mail_domain(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].lower().strip()
    # light check — common providers (full SSOT in JS; sample uses short list)
    free = {
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
    return domain in free


def select_sample(
    deals: list[dict],
    links: dict[int, dict],
    biz: dict[int, str | None],
    limit: int,
) -> list[dict]:
    in_win = [d for d in deals if (d.get("_export") or {}).get("in_age_window") and d.get("person_id")]
    linked = [d for d in in_win if int(d["person_id"]) in links]
    with_prod = [d for d in in_win if biz.get(int(d["id"]))]
    open_d = [d for d in in_win if (d.get("status") or "").lower() == "open"]
    won_d = [d for d in in_win if (d.get("status") or "").lower() == "won"]
    lost_d = [d for d in in_win if (d.get("status") or "").lower() == "lost"]

    picked: list[dict] = []
    seen: set[int] = set()

    def take(pool: list[dict], n: int) -> None:
        for d in pool:
            if len(picked) >= limit:
                return
            did = int(d["id"])
            if did in seen:
                continue
            seen.add(did)
            picked.append(d)
            if sum(1 for x in picked if int(x["person_id"]) in links) >= n and n:
                # soft target only for linked bucket
                pass

    # diversify
    take([d for d in linked if (d.get("status") or "").lower() == "open"], 3)
    take([d for d in linked if (d.get("status") or "").lower() == "won"], 2)
    take([d for d in linked if (d.get("status") or "").lower() == "lost"], 2)
    take([d for d in with_prod if int(d["person_id"]) not in links], 3)
    take([d for d in open_d if int(d["person_id"]) not in links], 3)
    take(won_d, 2)
    take(lost_d, 2)
    take(in_win, limit)
    return picked[:limit]


def find_existing_by_pipedrive(collection: str, pd_id: str) -> str | None:
    filt = urllib.parse.quote(f'pipedriveId[eq]:{pd_id}', safe="")
    st, payload = http_json("GET", f"/{collection}?filter={filt}&limit=1")
    if st != 200:
        return None
    rows = (payload.get("data") or {}).get(collection) or []
    return rows[0]["id"] if rows else None


def create_note(body: str, opportunity_id: str) -> tuple[int, str | None]:
    st, res = http_json(
        "POST",
        "/notes",
        {
            "title": "Pipedrive — maile / migracja",
            "bodyV2": {"markdown": body[:8000]},
        },
    )
    if st not in (200, 201):
        return st, None
    note_id = extract_created_id("notes", res)
    if not note_id:
        return st, None
    st2, _ = http_json(
        "POST",
        "/noteTargets",
        {"noteId": note_id, "targetOpportunityId": opportunity_id},
    )
    return (st2 if st2 not in (200, 201) else st), note_id if st2 in (200, 201) else None


def find_person_by_email(email: str) -> str | None:
    filt = urllib.parse.quote(f"emails.primaryEmail[eq]:{email}", safe="")
    st, payload = http_json("GET", f"/people?filter={filt}&limit=1")
    if st != 200:
        return None
    rows = (payload.get("data") or {}).get("people") or []
    return rows[0]["id"] if rows else None


def backfill_existing(run: Path, *, dry_run: bool = False) -> int:
    """Patch already-imported PIPEDRIVE_LEGACY opps: name, bizProduct, value label, junk company."""
    persons = index_by_id(load_pages(run / "persons"))
    orgs = index_by_id(load_pages(run / "organizations"))
    deals = index_by_id(load_pages(run / "deals"))
    biz = load_bizproduct(run)
    stages_raw = json.loads((run / "meta" / "stages.json").read_text(encoding="utf-8"))
    stage_names = {int(s["id"]): s["name"] for s in stages_raw.get("data") or []}

    opps: list[dict] = []
    cursor = None
    while True:
        qs: dict[str, str] = {
            "limit": "60",
            "filter": "srcSystem[eq]:PIPEDRIVE_LEGACY",
        }
        if cursor:
            qs["starting_after"] = cursor
        st, page = http_json("GET", "/opportunities?" + urllib.parse.urlencode(qs))
        if st != 200:
            print(f"list opps FAIL {st} {page}")
            return 1
        batch = (page.get("data") or {}).get("opportunities") or []
        opps.extend(batch)
        pi = page.get("pageInfo") or {}
        cursor = pi.get("endCursor") if pi.get("hasNextPage") else None
        if not cursor or len(batch) < 60:
            break
        time.sleep(1.2)

    print(f"Backfill {len(opps)} PIPEDRIVE_LEGACY opportunities dry_run={dry_run}")
    report: list[dict] = []
    for i, opp in enumerate(opps, 1):
        pid_raw = opp.get("pipedriveId")
        if not pid_raw or not str(pid_raw).isdigit():
            continue
        did = int(pid_raw)
        deal = deals.get(did)
        if not deal:
            report.append({"deal_id": did, "opp_id": opp.get("id"), "skipped": "deal_missing"})
            continue
        person_pd_id = deal.get("person_id")
        person = persons.get(int(person_pd_id)) if person_pd_id else None
        org_pd_id = deal.get("org_id")
        org = orgs.get(int(org_pd_id)) if org_pd_id else None
        emails: list[str] = []
        if person:
            for e in person.get("emails") or []:
                ne = norm_email((e or {}).get("value"))
                if ne:
                    emails.append(ne)
        stage, _ = map_stage(deal, stage_names)
        bp = biz.get(did) or "INNE"
        name = compose_opportunity_name(deal, person, org, emails)
        patch: dict = {"name": name, "bizProduct": bp}
        apply_value_fields(patch, deal, stage)
        # Clear junk company link on card
        clear_company = False
        if opp.get("companyId"):
            if not usable_org(org):
                clear_company = True
            else:
                # also clear if linked Twenty company name is junk
                stc, co = http_json("GET", f"/companies/{opp['companyId']}")
                time.sleep(0.8)
                if stc == 200:
                    company = (co.get("data") or {}).get("company") or (co.get("data") or {})
                    if is_junk_label(company.get("name")):
                        clear_company = True
        if clear_company:
            patch["companyId"] = None

        row = {
            "deal_id": did,
            "opp_id": opp.get("id"),
            "old_name": opp.get("name"),
            "new_name": name,
            "bizProduct": bp,
            "bizValueDisplay": patch.get("bizValueDisplay"),
            "clear_company": clear_company,
        }
        print(
            f"[{i}/{len(opps)}] {did} {opp.get('name')!r} → {name!r} "
            f"bp={bp} clear_co={clear_company}"
        )
        if dry_run:
            report.append(row)
            continue
        st, res = http_json("PATCH", f"/opportunities/{opp['id']}", patch)
        row["patch_status"] = st
        if st not in (200, 201):
            row["error"] = res.get("error")
            print(f"  PATCH FAIL {st} {res.get('error')}")
        report.append(row)
        time.sleep(1.2)

    out = run / "sample" / "backfill_results.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if dry_run:
        print(f"\nBackfill dry-run: {len(report)} → {out}")
        return 0
    fails = [r for r in report if "patch_status" in r and r["patch_status"] not in (200, 201)]
    ok = len(report) - len(fails)
    print(f"\nBackfill done: {ok}/{len(report)} ok, {len(fails)} fail → {out}")
    return 0 if not fails else 1


def load_done_deal_ids(progress_path: Path) -> set[int]:
    """Deals successfully imported or intentionally skipped. Errors are retriable."""
    done: set[int] = set()
    if not progress_path.is_file():
        return done
    for line in progress_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        did = o.get("deal_id")
        if did is None:
            continue
        if o.get("opportunity_error") or o.get("person_error"):
            continue
        if o.get("opportunity_id") or o.get("skipped") in (
            "already_imported",
            "dry_run",
        ):
            done.add(int(did))
    return done


def append_progress(progress_path: Path, row: dict) -> None:
    with progress_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_load_summary(out_dir: Path, results: list[dict], *, run_id: str, mode: str) -> dict:
    summary = {
        "run_id": run_id,
        "mode": mode,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "count": len(results),
        "ok_opps": sum(
            1
            for r in results
            if r.get("opportunity_id") and not r.get("opportunity_error")
        ),
        "skipped_already": sum(1 for r in results if r.get("skipped") == "already_imported"),
        "no_person": sum(1 for r in results if not r.get("person_pd_id")),
        "linked_people": sum(1 for r in results if r.get("person_mode") == "link"),
        "with_bizProduct_mapped": sum(
            1 for r in results if r.get("bizProduct") and r.get("bizProduct") != "INNE"
        ),
        "errors": [
            r
            for r in results
            if r.get("opportunity_error") or r.get("person_error")
        ],
        "stages": {},
    }
    from collections import Counter

    summary["stages"] = dict(Counter(r.get("stage") for r in results if r.get("stage")))
    (out_dir / f"{mode}_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return summary


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=None)
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--full",
        action="store_true",
        help="Load all in-age-window deals (idempotent; writes full/progress.jsonl)",
    )
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Patch existing PIPEDRIVE_LEGACY opps (name / bizProduct / value / junk company)",
    )
    args = parser.parse_args()
    run = resolve_run(args.run)
    mode = "full" if args.full else "sample"
    out_dir = run / mode
    out_dir.mkdir(parents=True, exist_ok=True)
    progress_path = out_dir / "progress.jsonl"
    pace = 0.55 if args.full else 1.2

    if args.backfill:
        return backfill_existing(run, dry_run=args.dry_run)

    print(f"Run: {run.name} mode={mode} limit={args.limit} dry_run={args.dry_run}")

    stages_raw = json.loads((run / "meta" / "stages.json").read_text(encoding="utf-8"))
    stage_names = {int(s["id"]): s["name"] for s in stages_raw.get("data") or []}
    persons = index_by_id(load_pages(run / "persons"))
    orgs = index_by_id(load_pages(run / "organizations"))
    deals_all = load_pages(run / "deals")
    links = load_identity_links(run)
    biz = load_bizproduct(run)
    mailbox = load_mailbox_notes(run)

    activities_by_deal: dict[int, list[dict]] = {}
    for a in load_pages(run / "activities"):
        did = a.get("deal_id")
        if did is not None:
            activities_by_deal.setdefault(int(did), []).append(a)
    notes_by_deal: dict[int, list[dict]] = {}
    for n in load_pages(run / "notes"):
        did = n.get("deal_id")
        if did is not None:
            notes_by_deal.setdefault(int(did), []).append(n)

    if args.full:
        sample = [
            d
            for d in deals_all
            if (d.get("_export") or {}).get("in_age_window")
        ]
        sample.sort(key=lambda d: d.get("add_time") or "")
        done_ids = load_done_deal_ids(progress_path)
        if done_ids:
            before = len(sample)
            sample = [d for d in sample if int(d["id"]) not in done_ids]
            print(f"Resume: skip {before - len(sample)} already in {progress_path.name}")
    else:
        sample = select_sample(deals_all, links, biz, args.limit)
    print(f"Selected {len(sample)} deals")

    results: list[dict] = []
    created_companies: dict[int, str] = {}
    created_people: dict[int, str] = {}
    ok_count = 0
    err_count = 0
    skip_count = 0

    for i, deal in enumerate(sample, 1):
        did = int(deal["id"])
        person_pd_id = int(deal["person_id"]) if deal.get("person_id") else None
        person = persons.get(person_pd_id) if person_pd_id else None
        org_pd_id = deal.get("org_id")
        org = orgs.get(int(org_pd_id)) if org_pd_id else None
        owner = (deal.get("_export") or {}).get("owner_map") or {}
        owner_id = owner.get("twenty_member_id") or "2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d"
        stage, legacy_stage = map_stage(deal, stage_names)
        bp = biz.get(did) or "INNE"
        link = links.get(person_pd_id) if person_pd_id else None

        emails = []
        phones = []
        if person:
            for e in person.get("emails") or []:
                ne = norm_email((e or {}).get("value"))
                if ne:
                    emails.append(ne)
            for p in person.get("phones") or []:
                np = norm_phone((p or {}).get("value"))
                if np:
                    phones.append(np)

        opp_name = compose_opportunity_name(deal, person, org, emails)
        row: dict = {
            "deal_id": did,
            "title": deal.get("title"),
            "name": opp_name,
            "status": deal.get("status"),
            "stage": stage,
            "legacy_stage": legacy_stage,
            "person_pd_id": person_pd_id,
            "org_pd_id": org_pd_id,
            "link": bool(link),
            "bizProduct": bp,
            "ownerId": owner_id,
        }
        print(
            f"\n[{i}/{len(sample)}] deal={did} {deal.get('title')!r} → name={opp_name!r} "
            f"→ {stage} link={bool(link)} bp={bp} person={person_pd_id}"
        )

        if args.dry_run:
            results.append(row)
            if args.full:
                append_progress(progress_path, {**row, "skipped": "dry_run"})
            continue

        # idempotent: skip if deal already imported
        existing_opp = find_existing_by_pipedrive("opportunities", str(did))
        if existing_opp:
            row["opportunity_id"] = existing_opp
            row["skipped"] = "already_imported"
            print(f"  skip opp already {existing_opp}")
            results.append(row)
            skip_count += 1
            if args.full:
                append_progress(progress_path, row)
            time.sleep(pace * 0.4)
            continue

        company_id = None
        if usable_org(org) and org_pd_id:
            oid = int(org_pd_id)
            if oid in created_companies:
                company_id = created_companies[oid]
            else:
                existing_co = find_existing_by_pipedrive("companies", str(oid))
                if existing_co:
                    company_id = existing_co
                else:
                    co_body = {
                        "name": clean_label(org.get("name")) or f"PD org {oid}",
                        "pipedriveId": str(oid),
                    }
                    st, res = http_json("POST", "/companies", co_body)
                    company_id = extract_created_id("companies", res) if st in (200, 201) else None
                    row["company_create_status"] = st
                    if not company_id:
                        row["company_error"] = res.get("error")
                        print(f"  company FAIL {st} {res.get('error')}")
                if company_id:
                    created_companies[oid] = company_id
            row["company_id"] = company_id
            time.sleep(pace)
        elif org_pd_id and org and is_junk_label(org.get("name")):
            row["company_skipped"] = "junk_org_name"

        # person (optional — 440 deali w oknie bez person_id)
        person_id = None
        if not person_pd_id:
            row["person_mode"] = "none"
        elif link:
            person_id = link["twenty_id"]
            row["person_id"] = person_id
            row["person_mode"] = "link"
            # stamp pipedriveId + phone from PD if Twenty person missing phone
            person_patch: dict = {"pipedriveId": str(person_pd_id)}
            if phones:
                ph = phone_payload(phones[0])
                if ph:
                    person_patch["phones"] = ph
            st, _ = http_json(
                "PATCH",
                f"/people/{person_id}",
                person_patch,
            )
            row["person_link_patch"] = st
            print(f"  link person {person_id} patch={st}")
            time.sleep(pace)
        elif person_pd_id in created_people:
            person_id = created_people[person_pd_id]
            row["person_mode"] = "reuse_batch"
            row["person_id"] = person_id
        else:
            existing_pe = find_existing_by_pipedrive("people", str(person_pd_id))
            if existing_pe:
                person_id = existing_pe
                row["person_mode"] = "existing_pipedriveId"
            else:
                name = split_name((person or {}).get("name") or "Unknown")
                pe_body: dict = {
                    "name": name,
                    "pipedriveId": str(person_pd_id),
                    # no idOid
                }
                if emails:
                    # duplicate email → reuse existing Twenty person (owner policy)
                    existing_by_email = find_person_by_email(emails[0])
                    if existing_by_email:
                        person_id = existing_by_email
                        row["person_mode"] = "email_dedup"
                        person_patch: dict = {"pipedriveId": str(person_pd_id)}
                        if phones:
                            ph = phone_payload(phones[0])
                            if ph:
                                person_patch["phones"] = ph
                        http_json(
                            "PATCH",
                            f"/people/{person_id}",
                            person_patch,
                        )
                        created_people[person_pd_id] = person_id
                        row["person_id"] = person_id
                        print(f"  email_dedup person {person_id}")
                        time.sleep(pace)
                        # jump to opportunity via flag
                        pe_body = {}
                if person_id is None:
                    if emails:
                        pe_body["emails"] = {"primaryEmail": emails[0]}
                        if len(emails) > 1:
                            pe_body["emails"]["additionalEmails"] = emails[1:5]
                    ph = phone_payload(phones[0]) if phones else None
                    if ph:
                        pe_body["phones"] = ph
                    if company_id:
                        pe_body["companyId"] = company_id
                    add_time = (person or {}).get("add_time")
                    if add_time:
                        pe_body["createdAt"] = (
                            add_time.replace("Z", ".000Z")
                            if add_time.endswith("Z")
                            else add_time
                        )
                    st, res = http_json("POST", "/people", pe_body)
                    person_id = extract_created_id("people", res) if st in (200, 201) else None
                    row["person_create_status"] = st
                    if not person_id:
                        # last resort: email dedup after duplicate error
                        if emails:
                            person_id = find_person_by_email(emails[0])
                            if person_id:
                                row["person_mode"] = "email_dedup_after_fail"
                                http_json(
                                    "PATCH",
                                    f"/people/{person_id}",
                                    {"pipedriveId": str(person_pd_id)},
                                )
                        if not person_id:
                            row["person_error"] = res.get("error")
                            row["person_mode"] = "failed_skip"
                            print(
                                f"  person FAIL {st} {res.get('error')} "
                                f"— continue opp without person"
                            )
                            # do not abort deal — Opportunity bez kontaktu
                    else:
                        row["person_mode"] = "create"
                        print(f"  create person {person_id}")
            if person_pd_id and person_id and person_pd_id not in created_people:
                created_people[person_pd_id] = person_id
            if person_id:
                row["person_id"] = person_id
            time.sleep(pace)

        # opportunity
        add_time = deal.get("add_time") or ""
        created = add_time.replace("Z", ".000Z") if add_time.endswith("Z") else add_time
        opp_body: dict = {
            "name": opp_name,
            "stage": stage,
            "srcSystem": "PIPEDRIVE_LEGACY",
            "bizSource": "PIPEDRIVE_IMPORT",
            "pipedriveId": str(did),
            "legacyPipedriveStageName": legacy_stage,
            "ownerId": owner_id,
            "campaignRejected": False,
            "bizProduct": bp,
            # idOid intentionally omitted
        }
        if person_id:
            opp_body["pointOfContactId"] = person_id
        if created:
            opp_body["createdAt"] = created
            opp_body["legacyCreatedAt"] = created
        if company_id:
            opp_body["companyId"] = company_id
        # Lead card denorm — MUST be on Opportunity (kanban), not only Person
        if emails:
            opp_body["bizCardEmail"] = emails[0]
        if phones:
            opp_body["bizCardPhone"] = phones[0]
        apply_value_fields(opp_body, deal, stage)
        apply_last_contact_fields(
            opp_body,
            run,
            deal,
            activities_by_deal=activities_by_deal,
            notes_by_deal=notes_by_deal,
        )
        close = deal.get("won_time") or deal.get("lost_time") or deal.get("close_time")
        if close:
            opp_body["closeDate"] = close.replace("Z", ".000Z") if str(close).endswith("Z") else close

        st, res = http_json("POST", "/opportunities", opp_body)
        opp_id = extract_created_id("opportunities", res) if st in (200, 201) else None
        row["opportunity_create_status"] = st
        row["opportunity_id"] = opp_id
        if not opp_id:
            row["opportunity_error"] = res.get("error")
            print(f"  opp FAIL {st} {res.get('error')}")
            results.append(row)
            err_count += 1
            if args.full:
                append_progress(progress_path, row)
            continue
        print(f"  create opp {opp_id}")
        ok_count += 1
        time.sleep(pace)

        # mailbox note
        note_body = mailbox.get(did)
        if not note_body:
            note_body = (
                f"[Pipedrive import] deal_id={did}; stage_PD={legacy_stage}; "
                f"status={deal.get('status')}; owner_PD={owner.get('pd_name')}"
            )
        nst, nid = create_note(note_body, opp_id)
        row["note_status"] = nst
        row["note_id"] = nid
        print(f"  note status={nst} id={nid}")
        time.sleep(pace)

        results.append(row)
        if args.full:
            append_progress(progress_path, row)
        if args.full and i % 25 == 0:
            snap = write_load_summary(out_dir, results, run_id=run.name, mode=mode)
            print(
                f"  … checkpoint i={i} ok={ok_count} skip={skip_count} err={err_count} "
                f"session_ok={snap['ok_opps']}"
            )

    summary = write_load_summary(out_dir, results, run_id=run.name, mode=mode)
    summary["limit"] = args.limit
    summary["dry_run"] = args.dry_run
    summary["ok_created_this_run"] = ok_count
    summary["skipped_this_run"] = skip_count
    summary["errors_this_run"] = err_count
    results_name = "full_results.json" if args.full else "sample_results.json"
    (out_dir / results_name).write_text(
        json.dumps({"summary": summary, "results": results}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (out_dir / f"{mode}_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print("\n=== DONE ===")
    print(json.dumps({k: v for k, v in summary.items() if k != "errors"}, indent=2, ensure_ascii=False))
    if summary["errors"]:
        print(f"errors: {len(summary['errors'])} (see {results_name})")
    print(f"Artefacts: {out_dir}")
    return 0 if not summary["errors"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
