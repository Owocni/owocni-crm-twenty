#!/usr/bin/env python3
"""Remediate Gosia ghost leads@ cards vs Better Bitrix (2026-08-28).

Dry-run by default; pass --apply to mutate Twenty.
Evidence → integrations/runbooks/exports/bb_sync/remediate_gosia_ghosts_*.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from twenty_rest import http_json, load_env  # noqa: E402

UA = "owocni-remediate-gosia-ghosts/1.0"
OUT = (
    Path(__file__).resolve().parents[1]
    / "runbooks"
    / "exports"
    / "bb_sync"
)

MARTA = "4704e0c0-8d77-4640-ad1e-1875294294df"
GOSIA = "ccac533d-a34b-4cfc-a036-9e75ee3f8910"
MACIEJ = "7fddba1d-e443-47d4-97b7-a3a829efd8c1"

# Actions aligned to BB state (checked 2026-08-28).
ACTIONS = [
    {
        "email": "plprofidach@gmail.com",
        "action": "delete_duplicate",
        "reason": "Duplikat: BB#9024 Maciej inquiry→CONTACTED już w Twenty; ghost TWENTY_EMAIL u Gosi",
        "delete_opp_id": "3f10dc9a-03dc-4755-b362-e6a6cf952b12",
        "keep_opp_id": "70a44ae0-9f5c-4227-a9c1-9363a2a45755",
        "stamp_id_oid": "GACRFV8FFZ2Y942QYWZK4YKK3X",
        "bb_id": 9024,
    },
    {
        "email": "jakub.orlowski@bws.poznan.pl",
        "action": "align_to_bb",
        "reason": "Ghost leads@ NEW → BB#4791 Marta analysis (PROPOSAL)",
        "opp_id": "4be0efae-e6e7-4076-9e92-2f6fcd06fbc8",
        "bb_id": 4791,
        "patch": {
            "ownerId": MARTA,
            "stage": "PROPOSAL",
            "bitrixDealId": "bb:4791",
            "srcSystem": "BETTER_BITRIX_LEGACY",
            "bizProduct": "WEB",
            "bizSource": "MANUAL",
            "name": "jakub.orlowski@bws.poznan.pl · Strona · BB#4791",
            "idOid": "7FSKW3YMV5TTQGRK0H099K1PRV",
            "campaignRejected": False,
        },
    },
    {
        "email": "j.andrzejczyk.gorlewska@planetarium.olsztyn.pl",
        "action": "align_to_bb",
        "reason": "Ghost leads@ NEW → BB#7349 Gosia negotiations (PROPOSAL)",
        "opp_id": "92200eae-1fb0-4432-b020-dbd133a817ae",
        "bb_id": 7349,
        "patch": {
            "ownerId": GOSIA,
            "stage": "PROPOSAL",
            "bitrixDealId": "bb:7349",
            "srcSystem": "BETTER_BITRIX_LEGACY",
            "bizProduct": "LOGO",
            "bizSource": "MANUAL",
            "name": "j.andrzejczyk.gorlewska@planetarium.olsztyn.pl · Logo · BB#7349",
            "idOid": "A6ZPR8RN434EYAQVNHBXBFGZZQ",
            "campaignRejected": False,
        },
    },
    {
        "email": "daria.kozieja@gamecape.pl",
        "action": "archive_no_bb",
        "reason": "Brak deala w BB; ghost leads@ NEW z 4.08 — archiwum LOST (osoba+maile zostają)",
        "opp_id": "b618c199-b4f9-4076-af5a-6b07f788dfd6",
        "bb_id": None,
        "patch": {
            "stage": "LOST",
            "name": "[brak BB] daria.kozieja@gamecape.pl — mail leads@ (archiwum)",
        },
        "note": "Aktywna korespondencja 24.08 — jeśli Gosia prowadzi sprawę, można cofnąć LOST→CONTACTED",
    },
]


def snapshot_opp(opp_id: str) -> dict:
    st, res = http_json("GET", f"/opportunities/{opp_id}", user_agent=UA)
    if st != 200:
        return {"http_status": st, "error": res}
    o = (res.get("data") or {}).get("opportunity") or {}
    return {
        "id": o.get("id"),
        "name": o.get("name"),
        "stage": o.get("stage"),
        "ownerId": o.get("ownerId"),
        "srcSystem": o.get("srcSystem"),
        "bitrixDealId": o.get("bitrixDealId"),
        "idOid": o.get("idOid"),
        "createdAt": o.get("createdAt"),
    }


def run(*, apply: bool) -> dict:
    load_env()
    evidence: dict = {
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "apply": apply,
        "results": [],
    }

    for spec in ACTIONS:
        row: dict = {
            "email": spec["email"],
            "action": spec["action"],
            "reason": spec["reason"],
            "bb_id": spec.get("bb_id"),
        }
        print(f"\n=== {spec['email']} · {spec['action']} ===", flush=True)
        print(f"  {spec['reason']}", flush=True)

        if spec["action"] == "delete_duplicate":
            dead = spec["delete_opp_id"]
            keep = spec["keep_opp_id"]
            row["before_delete"] = snapshot_opp(dead)
            row["before_keep"] = snapshot_opp(keep)
            print(f"  DELETE {dead}", flush=True)
            print(f"  KEEP   {keep} + idOid={spec['stamp_id_oid']}", flush=True)
            if apply:
                st, res = http_json("DELETE", f"/opportunities/{dead}", user_agent=UA)
                row["delete_http"] = st
                row["delete_ok"] = st in (200, 204)
                time.sleep(0.4)
                st2, res2 = http_json(
                    "PATCH",
                    f"/opportunities/{keep}",
                    {"idOid": spec["stamp_id_oid"], "bitrixDealId": f"bb:{spec['bb_id']}"},
                    user_agent=UA,
                )
                row["stamp_http"] = st2
                row["after_keep"] = snapshot_opp(keep)
                print(f"  → delete={st} stamp={st2}", flush=True)
            else:
                row["dry_run"] = True

        elif spec["action"] in ("align_to_bb", "archive_no_bb"):
            oid = spec["opp_id"]
            row["before"] = snapshot_opp(oid)
            row["patch"] = spec["patch"]
            if spec.get("note"):
                row["note"] = spec["note"]
                print(f"  NOTE: {spec['note']}", flush=True)
            print(f"  PATCH {oid} → {spec['patch']}", flush=True)
            if apply:
                st, res = http_json(
                    "PATCH", f"/opportunities/{oid}", spec["patch"], user_agent=UA
                )
                row["http_status"] = st
                row["ok"] = st in (200, 201)
                if st not in (200, 201):
                    row["error"] = res
                time.sleep(0.4)
                row["after"] = snapshot_opp(oid)
                print(f"  → {st}", flush=True)
            else:
                row["dry_run"] = True

        evidence["results"].append(row)

    evidence["finishedAt"] = datetime.now(timezone.utc).isoformat()
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mode = "apply" if apply else "dryrun"
    path = OUT / f"remediate_gosia_ghosts_{mode}_{stamp}.json"
    path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n→ {path}", flush=True)
    return evidence


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write changes to Twenty")
    args = ap.parse_args()
    run(apply=args.apply)


if __name__ == "__main__":
    main()
