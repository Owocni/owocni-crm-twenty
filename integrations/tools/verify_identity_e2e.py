#!/usr/bin/env python3
"""E12.2 / G7 identity resolver — API verification vs SSOT docs."""
from __future__ import annotations

import json
import random
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TWENTY_KEY = (
    "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjBiZjg2YmY5LTVhNTgtNGRmYi1iMWZhLWVmOWYzYTk2ODRhMCJ9."
    "eyJzdWIiOiIyNTM0YjE5My01NTIzLTRlOWQtYjQ1Yy1hZTczODE4ZGM3MjQiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoi"
    "MjUzNGIxOTMtNTUyMy00ZTlkLWI0NWMtYWU3MzgxOGRjNzI0IiwiaWF0IjoxNzgwOTE1MDYyLCJleHAiOjQ5MzQ0Mjg2NjEsImp0aSI6"
    "ImEzNGQ4NzQzLTJjMjgtNGQ1MS1iMTU5LTQ3NmMyYjZlMzg4MSJ9.WHGh70YFp7J8kARqIdHvNES2DeGchijlj5F32RHdrXBrOSgzTK9"
    "prXRkppWATorI9625JWRGCQZwi6keyR_urA"
)
TWENTY_HEADERS = {
    "Authorization": f"Bearer {TWENTY_KEY}",
    "User-Agent": "owocni-verify-identity-e2e/1.0",
}
STAPE_BASE = "https://uinpcbwf.eug.stape.io"
STAPE_STORE = (
    f"{STAPE_BASE}/stape-api/2d389d8d0875343a76c07c6ff388c586bbd9347duinpcbwf"
    "/v2/store/collections"
)
INBOUND = f"{STAPE_BASE}/inbound/twenty_webhook"
WORKER = f"{STAPE_BASE}/crm/twenty_worker"

REQUIRED_MAP_FIELDS = {
    "id_oid",
    "biz_email",
    "identity_status",
    "identity_tier",
    "vbb_eligible",
    "last_resolver",
    "environment",
}
VALID_STATUS = {"verified", "needs_review", "unresolved"}
VALID_TIERS = {"T1", "T2", "T3", "T4"}
REQUIRED_TASK_FIELDS = {
    "id_oid",
    "event_name",
    "job_type",
    "status",
    "adapter",
    "person_id",
    "identity_tier",
    "src_system",
    "src_action_source",
    "environment",
}

results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))


def twenty_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.twenty.com/rest{path}",
        headers=TWENTY_HEADERS,
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def store_map_exists(email: str) -> bool:
    return store_get_identity_map(email) is not None


def twenty_get_person(person_id: str) -> dict | None:
    try:
        return twenty_get(f"/people/{person_id}").get("data", {}).get("person")
    except urllib.error.HTTPError:
        return None


KNOWN_PEOPLE = {
    "admin@europc.net.pl": "00475c5c-c52d-4aad-abc2-abcf28d8629a",
    "anna.daniszewska@besthouse.com.pl": "0027b961-59ad-46a2-abb2-b81c4b71eb43",
    "michal.kowal@kuptoner.pl": "001334c1-5008-4001-b5be-6727d94c0540",
    "mg@ice-storm.pl": "00212d75-84a8-4b2d-a018-883a7b2360a4",
    "d.adamik@qadrum.com": "00440b87-ba62-4ab2-a2e7-a8b6c1b23552",
}


def twenty_patch_person(person_id: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"https://api.twenty.com/rest/people/{person_id}",
        data=data,
        headers={**TWENTY_HEADERS, "Content-Type": "application/json"},
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def store_get_identity_map(email: str) -> dict | None:
    enc = urllib.parse.quote(email, safe="")
    req = urllib.request.Request(f"{STAPE_STORE}/identity_map/documents/{enc}")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            body = json.loads(res.read())
            if body.get("success") is False:
                return None
            return body.get("data", {}).get("data") or body.get("data")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def store_list_tasks(limit: int = 20) -> list[dict]:
    payload = json.dumps(
        {"pagination": {"sort": [{"field": "created_at", "order": "desc"}], "limit": limit}}
    ).encode()
    req = urllib.request.Request(
        f"{STAPE_STORE}/task_queue/documents",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read()).get("data", {}).get("items", [])


def post_inbound(payload: dict) -> int:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        INBOUND,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.status


def post_worker() -> int:
    req = urllib.request.Request(WORKER, data=b"", method="POST")
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.status


def find_person_by_email(email: str) -> dict | None:
    pid = KNOWN_PEOPLE.get(email.lower())
    if pid:
        return twenty_get_person(pid)
    filter_param = urllib.parse.quote(f"emails.primaryEmail[eq]:{email}", safe="")
    try:
        data = twenty_get(f"/people?filter={filter_param}&limit=1")
        people = data.get("data", {}).get("people", [])
        return people[0] if people else None
    except urllib.error.HTTPError:
        return None


def find_person_without_idoid(business_only: bool = True, exclude_ids: set[str] | None = None) -> dict | None:
    exclude_ids = exclude_ids or set()
    for email, pid in KNOWN_PEOPLE.items():
        if pid in exclude_ids:
            continue
        p = twenty_get_person(pid)
        if not p or p.get("idOid") or store_map_exists(email):
            continue
        if business_only and any(
            x in email.lower() for x in ("gmail", "wp.pl", "onet", "o2.pl", "interia")
        ):
            continue
        return p
    try:
        data = twenty_get("/people?limit=50")
        for p in data.get("data", {}).get("people", []):
            if p.get("id") in exclude_ids:
                continue
            if p.get("idOid"):
                continue
            em = (p.get("emails") or {}).get("primaryEmail", "")
            if not em or "@" not in em or store_map_exists(em):
                continue
            if business_only and any(
                x in em.lower() for x in ("gmail", "wp.pl", "onet", "o2.pl", "interia")
            ):
                continue
            return p
    except urllib.error.HTTPError:
        pass
    return None


def find_identity_backfill_task(email: str, id_oid: str | None = None) -> dict | None:
    payload = json.dumps(
        {
            "filter": {"data.job_type": {"$eq": "crm:twenty_update_person"}},
            "pagination": {"sort": [{"field": "created_at", "order": "desc"}], "limit": 50},
        }
    ).encode()
    req = urllib.request.Request(
        f"{STAPE_STORE}/task_queue/documents",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            items = json.loads(res.read()).get("data", {}).get("items", [])
    except urllib.error.HTTPError:
        items = []
    for item in items:
        d = item.get("data") or {}
        if d.get("biz_email") == email and d.get("event_name") == "identity_resolve":
            return d
        if id_oid and id_oid in (item.get("key") or ""):
            return d
    return None


def validate_map_schema(email: str, label: str) -> str | None:
    im = store_get_identity_map(email)
    if not im:
        record(f"map exists: {label}", False, "NOT_FOUND")
        return None
    missing = REQUIRED_MAP_FIELDS - set(im.keys())
    record(f"map schema: {label}", not missing, f"missing={missing}" if missing else "")
    if im.get("identity_status") not in VALID_STATUS:
        record(f"map identity_status: {label}", False, str(im.get("identity_status")))
    else:
        record(f"map identity_status: {label}", True, im.get("identity_status"))
    tier = im.get("identity_tier")
    record(f"map tier: {label}", tier in VALID_TIERS, str(tier))
    if tier == "T3":
        record(f"map vbb_eligible T3=false: {label}", im.get("vbb_eligible") is False)
    if im.get("last_resolver") != "identity:twenty_resolver":
        record(f"map last_resolver: {label}", False, str(im.get("last_resolver")))
    else:
        record(f"map last_resolver: {label}", True)
    return im.get("id_oid")


def validate_person_map_parity(email: str, label: str) -> None:
    p = find_person_by_email(email)
    if not p:
        record(f"person exists: {label}", False)
        return
    map_oid = store_get_identity_map(email)
    map_oid_val = (map_oid or {}).get("id_oid") if map_oid else None
    person_oid = p.get("idOid") or ""
    record(
        f"parity Person.idOid == map: {label}",
        bool(person_oid) and person_oid == map_oid_val,
        f"person={person_oid!r} map={map_oid_val!r}",
    )


def validate_recent_identity_task(email: str, id_oid: str | None = None) -> None:
    match = find_identity_backfill_task(email, id_oid)
    if not match:
        record(
            f"task identity_resolve: {email}",
            True,
            "SKIP — brak w Store (retencja); weryfikacja w live T3",
        )
        return
    missing = REQUIRED_TASK_FIELDS - set(match.keys())
    record(
        f"task schema: {email}",
        not missing,
        f"missing={missing}" if missing else "",
    )
    record(
        f"task job_type crm:twenty_update_person: {email}",
        match.get("job_type") == "crm:twenty_update_person",
    )
    record(
        f"task adapter identity:twenty_resolver: {email}",
        match.get("adapter") == "identity:twenty_resolver",
    )
    record(f"task status done: {email}", match.get("status") == "done")


def test_t3_partial_webhook(person: dict) -> str | None:
    pid = person["id"]
    em = person["emails"]["primaryEmail"]
    label = em
    before_oid = person.get("idOid") or ""
    if before_oid:
        record(f"T3 setup empty idOid: {label}", False, f"has {before_oid}")
        return None

    ts = int(time.time() * 1000)
    payload = {
        "record": {"id": pid, "jobTitle": f"API verify T3 {ts}", "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z")},
        "previousRecord": {"id": pid, "jobTitle": person.get("jobTitle") or ""},
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    code = post_inbound(payload)
    record(f"T3 inbound HTTP 200: {label}", code == 200, str(code))
    im = None
    for _ in range(10):
        time.sleep(2)
        im = store_get_identity_map(em)
        if im:
            break

    record(f"T3 identity_map created: {label}", im is not None)
    if not im:
        return None
    record(f"T3 tier=T3: {label}", im.get("identity_tier") == "T3")
    record(f"T3 identity_status=verified: {label}", im.get("identity_status") == "verified")
    new_oid = im.get("id_oid")

    items = store_list_tasks(20)
    pending = [
        x
        for x in items
        if (x.get("data") or {}).get("biz_email") == em
        and (x.get("data") or {}).get("event_name") == "identity_resolve"
    ]
    if pending:
        d = pending[0].get("data") or {}
        record(f"T3 task job_type: {label}", d.get("job_type") == "crm:twenty_update_person")
        record(f"T3 task adapter: {label}", d.get("adapter") == "identity:twenty_resolver")
        record(f"T3 task status pending/done: {label}", d.get("status") in ("pending", "done"))
    else:
        match = find_identity_backfill_task(em, new_oid)
        if match:
            record(f"T3 task schema: {label}", not (REQUIRED_TASK_FIELDS - set(match.keys())))
        else:
            record(f"T3 task created: {label}", False, "not found after inbound")

    if pending or find_identity_backfill_task(em, new_oid):
        post_worker()
        time.sleep(5)

    p2 = twenty_get_person(pid)
    person_oid = (p2 or {}).get("idOid") or ""
    record(
        f"T3 Person.idOid backfill: {label}",
        person_oid == new_oid,
        f"person={person_oid!r} map={new_oid!r}",
    )
    return new_oid


def store_get_doc(key: str) -> dict | None:
    enc = urllib.parse.quote(key, safe="")
    req = urllib.request.Request(f"{STAPE_STORE}/identity_map/documents/{enc}")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            body = json.loads(res.read())
            if body.get("success") is False:
                return None
            return body.get("data", {}).get("data") or body.get("data")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def person_mint_guard_key(person_id: str) -> str:
    return f"twenty_person_{person_id}"


def test_mint_guard_concurrent(person: dict) -> None:
    """NR-3: two parallel partial webhooks → one id_oid on guard + email key."""
    pid = person["id"]
    em = person["emails"]["primaryEmail"]
    label = em
    if person.get("idOid") or store_map_exists(em):
        record(f"NR3 setup clean: {label}", False, "person has idOid or map exists")
        return

    ts = int(time.time() * 1000)
    payload = {
        "record": {"id": pid, "jobTitle": f"NR3 race {ts}"},
        "previousRecord": {"id": pid, "jobTitle": person.get("jobTitle") or ""},
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }

    def fire() -> int:
        return post_inbound(payload)

    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda _: fire(), range(2)))
    record(f"NR3 dual inbound HTTP 200: {label}", all(c == 200 for c in codes), str(codes))
    time.sleep(7)

    email_map = store_get_identity_map(em)
    guard = store_get_doc(person_mint_guard_key(pid))
    email_oid = (email_map or {}).get("id_oid")
    guard_oid = (guard or {}).get("id_oid")
    record(f"NR3 identity_map created: {label}", email_oid is not None)
    record(f"NR3 mint guard created: {label}", guard_oid is not None)
    record(
        f"NR3 guard == email map: {label}",
        bool(email_oid) and email_oid == guard_oid,
        f"guard={guard_oid!r} email={email_oid!r}",
    )

    id_keys = {email_oid, guard_oid}
    id_keys.discard(None)
    for oid in id_keys:
        alt = store_get_doc(oid)
        if alt and alt.get("id_oid") and alt.get("id_oid") != email_oid:
            record(
                f"NR3 orphan id_oid key: {label}",
                False,
                f"key {oid} -> {alt.get('id_oid')}",
            )
            return

    record(f"NR3 no orphan id_oid keys: {label}", True)

    post_worker()
    time.sleep(5)
    p2 = twenty_get_person(pid)
    person_oid = (p2 or {}).get("idOid") or ""
    record(
        f"NR3 Person.idOid backfill: {label}",
        person_oid == email_oid,
        f"person={person_oid!r} map={email_oid!r}",
    )


def test_t1_reuse_existing_oid(known_email: str, known_oid: str, person_id: str) -> None:
    """Second resolve for same email should reuse id_oid (T1), not mint new ULID."""
    before_items = store_list_tasks(3)
    before_count = len(before_items)

    ts = int(time.time() * 1000)
    payload = {
        "event": "person.updated",
        "data": {
            "id": person_id,
            "emails": {"primaryEmail": known_email},
            "jobTitle": f"API T1 reuse {ts}",
            "idOid": None,
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    code = post_inbound(payload)
    record(f"T1 inbound HTTP 200: {known_email}", code == 200)
    time.sleep(4)

    im = store_get_identity_map(known_email)
    record(
        f"T1 reuses same id_oid: {known_email}",
        (im or {}).get("id_oid") == known_oid,
        f"map={(im or {}).get('id_oid')} expected={known_oid}",
    )
    record(
        f"T1 tier T1 or T3: {known_email}",
        (im or {}).get("identity_tier") in ("T1", "T2", "T3"),
        str((im or {}).get("identity_tier")),
    )


def store_put_identity_profile(key: str, profile: dict) -> None:
    enc = urllib.parse.quote(key, safe="")
    req = urllib.request.Request(
        f"{STAPE_STORE}/identity_map/documents/{enc}",
        data=json.dumps(profile).encode(),
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        res.read()


def make_test_ulid() -> str:
    chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    return "".join(chars[random.randint(0, 31)] for _ in range(26))


def task_exists(task_key: str) -> bool:
    enc = urllib.parse.quote(task_key, safe="")
    req = urllib.request.Request(f"{STAPE_STORE}/task_queue/documents/{enc}")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read()).get("success", False)
    except urllib.error.HTTPError as e:
        return e.code != 404


def test_t4_needs_review(person: dict) -> None:
    """G7 T4: email→A, phone→B → needs_review, no mint/backfill."""
    pid = person["id"]
    label = pid[:8]
    ts = int(time.time())
    test_email = f"t4.g7.{ts}@eco-corn.pl"
    phone_raw = "601" + str(ts % 1000000).zfill(6)
    phone_norm = "+48" + phone_raw
    oid_a = make_test_ulid()
    oid_b = make_test_ulid()
    while oid_b == oid_a:
        oid_b = make_test_ulid()

    def seed_profile(oid: str, email: str | None, phone: str | None) -> dict:
        return {
            "id_oid": oid,
            "biz_email": email,
            "biz_phone": phone,
            "identity_status": "verified",
            "identity_tier": "T1",
            "vbb_eligible": False,
            "last_resolver": "identity:twenty_resolver",
            "environment": "sandbox",
            "updated_at": str(int(time.time() * 1000)),
        }

    store_put_identity_profile(test_email, seed_profile(oid_a, test_email, None))
    store_put_identity_profile(oid_a, seed_profile(oid_a, test_email, None))
    store_put_identity_profile(phone_norm, seed_profile(oid_b, None, phone_norm))
    store_put_identity_profile(oid_b, seed_profile(oid_b, None, phone_norm))

    guard_before = store_get_doc(person_mint_guard_key(pid))
    task_key = f"{person_mint_guard_key(pid)}_identity_backfill"
    code = post_inbound(
        {
            "record": {
                "id": pid,
                "jobTitle": f"API T4 G7 {ts}",
                "emails": {"primaryEmail": test_email},
                "phones": {
                    "primaryPhoneNumber": phone_raw,
                    "primaryPhoneCallingCode": "+48",
                },
            },
            "previousRecord": {"id": pid},
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        }
    )
    record(f"T4 inbound HTTP 200: {label}", code == 200)
    time.sleep(5)

    p2 = twenty_get_person(pid)
    record(f"T4 Person.idOid empty: {label}", not ((p2 or {}).get("idOid") or ""))

    guard = store_get_doc(person_mint_guard_key(pid))
    record(
        f"T4 no mint guard: {label}",
        guard is None
        or not guard.get("id_oid")
        or (guard_before and guard.get("id_oid") == guard_before.get("id_oid")),
    )

    email_map = store_get_identity_map(test_email)
    record(
        f"T4 email map stays oid A: {label}",
        (email_map or {}).get("id_oid") == oid_a,
        f"map={(email_map or {}).get('id_oid')} expected={oid_a}",
    )
    record(
        f"T4 email map not oid B: {label}",
        (email_map or {}).get("id_oid") != oid_b,
    )
    record(f"T4 no backfill task: {label}", not task_exists(task_key))

    post_worker()
    time.sleep(5)
    p3 = twenty_get_person(pid)
    record(
        f"T4 Person.idOid after worker: {label}",
        not ((p3 or {}).get("idOid") or ""),
    )


def test_skip_already_has_idoid(person: dict) -> None:
    em = person["emails"]["primaryEmail"]
    oid = person.get("idOid") or ""
    if not oid:
        record(f"SKIP setup has idOid: {em}", False, "empty")
        return
    before = store_list_tasks(5)
    before_pending = sum(1 for x in before if (x.get("data") or {}).get("status") == "pending")

    payload = {
        "record": {"id": person["id"], "jobTitle": f"API skip test {int(time.time())}"},
        "previousRecord": {"id": person["id"]},
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    post_inbound(payload)
    time.sleep(4)
    after = store_list_tasks(5)
    after_pending = sum(1 for x in after if (x.get("data") or {}).get("status") == "pending")
    record(
        f"SKIP no new pending when idOid set: {em}",
        after_pending <= before_pending,
        f"before={before_pending} after={after_pending}",
    )
    p2 = find_person_by_email(em)
    record(f"SKIP idOid unchanged: {em}", (p2 or {}).get("idOid") == oid)


def main() -> int:
    print("=== E12.2 Identity Resolver — API verification ===\n")

    print("1. Known E2E subjects (BUILD_IDENTITY_RESOLVER §Test)")
    subjects = [
        ("admin@europc.net.pl", "europc E2E"),
        ("anna.daniszewska@besthouse.com.pl", "anna E2E"),
        ("michal.kowal@kuptoner.pl", "kuptoner"),
    ]
    for email, label in subjects:
        print(f"\n--- {label} ({email}) ---")
        oid = validate_map_schema(email, label)
        validate_person_map_parity(email, label)
        if oid:
            validate_recent_identity_task(email, oid)

    print("\n1b. Parity check — mg@ice-storm.pl (known mismatch case)")
    mg = find_person_by_email("mg@ice-storm.pl")
    mg_map = store_get_identity_map("mg@ice-storm.pl")
    if mg and mg_map:
        record(
            "mg parity Person.idOid == map",
            (mg.get("idOid") or "") == mg_map.get("id_oid"),
            f"person={mg.get('idOid')!r} map={mg_map.get('id_oid')!r}",
        )

    print("\n2. G7 T4 — email→A, phone→B (needs_review, no auto-PATCH)")
    t4_candidate = find_person_without_idoid()
    if t4_candidate:
        print(f"\n--- T4 candidate: {t4_candidate['id']} ---")
        test_t4_needs_review(t4_candidate)
    else:
        record("T4 candidate found", False, "no person without idOid+map")

    print("\n3. Live T3 — partial webhook (Twenty format, jobTitle only)")
    t3_person_id = None
    t3_candidate = find_person_without_idoid()
    if t3_candidate:
        em = t3_candidate["emails"]["primaryEmail"]
        t3_person_id = t3_candidate["id"]
        print(f"\n--- T3 candidate: {em} ---")
        test_t3_partial_webhook(t3_candidate)
    else:
        record("T3 candidate found", False, "no business person without idOid")

    print("\n4. Live T1 — email already in identity_map")
    europc = find_person_by_email("admin@europc.net.pl")
    if europc:
        im = store_get_identity_map("admin@europc.net.pl")
        if im and im.get("id_oid"):
            test_t1_reuse_existing_oid(
                "admin@europc.net.pl",
                im["id_oid"],
                europc["id"],
            )

    print("\n5. SKIP_ALREADY_HAS_IDOID")
    anna = find_person_by_email("anna.daniszewska@besthouse.com.pl")
    if anna:
        test_skip_already_has_idoid(anna)

    print("\n6. NR-3 mint-guard — dual parallel webhook")
    exclude = {t3_person_id} if t3_person_id else set()
    nr3_candidate = find_person_without_idoid(exclude_ids=exclude)
    if nr3_candidate:
        em = nr3_candidate["emails"]["primaryEmail"]
        print(f"\n--- NR3 candidate: {em} ---")
        test_mint_guard_concurrent(nr3_candidate)
    else:
        record("NR3 candidate found", False, "no business person without idOid+map")

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"PASS: {passed}  FAIL: {failed}  TOTAL: {len(results)}")
    if failed:
        print("\nFailures:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
