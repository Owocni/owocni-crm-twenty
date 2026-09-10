#!/usr/bin/env python3
"""Repair Robert Pipedrive stages: secondary pipelines → Inbound (main funnel).

Robert miał w PD 4 lejki. Import wziął bieżący stage_id, więc deale z
„Strategia → Abonament” / „Upselling” weszły jako NEW mimo że w lejku Inbound
ta sama osoba była już WON (Podpisano umowę).

Ten skrypt ustawia otwarte karty Twenty z lejków pobocznych na WON, gdy
ta sama person_id (albo org_id gdy brak osoby) ma deal Inbound ze status=won.

Domyślnie dry-run.
  python3 integrations/tools/repair_robert_inbound_stages.py
  python3 integrations/tools/repair_robert_inbound_stages.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from twenty_rest import http_json, load_env, paginate  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
UA = "owocni-repair-robert-inbound-stages/1.0"

ROBERT_PD_OWNER = 15403616
ROBERT_TWENTY_OWNER = "23ac9976-0232-4097-b056-5dc391bf7c34"
INBOUND_PIPELINE_ID = 1
SECONDARY_PIPELINE_IDS = {2, 3}  # Upselling, Strategia -> Abonament
CUTOFF = "2023-08-04"
OPEN_STAGES = {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "CONTRACT_SENT", "PAYING"}


def resolve_run(run_id: str | None) -> Path:
    if run_id:
        path = RUNS / run_id
        if not path.is_dir():
            raise SystemExit(f"Brak runu {path}")
        return path
    runs = sorted(p for p in RUNS.iterdir() if p.is_dir() and not p.name.startswith("."))
    if not runs:
        raise SystemExit(f"Brak runów w {RUNS}")
    return runs[-1]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_deals(run: Path) -> list[dict]:
    deals: list[dict] = []
    for f in sorted((run / "deals").glob("page_*.json")):
        deals.extend(load_json(f).get("data") or [])
    return deals


def iso_close(raw: str | None) -> str | None:
    if not raw:
        return None
    s = str(raw).strip()
    if s.endswith("Z") and ".000Z" not in s:
        return s.replace("Z", ".000Z")
    return s


def inbound_won_index(deals: list[dict]) -> tuple[dict[int, dict], dict[int, dict]]:
    by_person: dict[int, dict] = {}
    by_org: dict[int, dict] = {}
    inbound_won = [
        d
        for d in deals
        if d.get("pipeline_id") == INBOUND_PIPELINE_ID and (d.get("status") or "").lower() == "won"
    ]
    inbound_won.sort(key=lambda d: d.get("won_time") or d.get("update_time") or "")
    for d in inbound_won:
        pid = d.get("person_id")
        oid = d.get("org_id")
        if pid:
            by_person[int(pid)] = d
        if oid:
            by_org[int(oid)] = d
    return by_person, by_org


def counterpart(deal: dict, by_person: dict[int, dict], by_org: dict[int, dict]) -> dict | None:
    pid = deal.get("person_id")
    if pid and int(pid) in by_person:
        return by_person[int(pid)]
    oid = deal.get("org_id")
    if not pid and oid and int(oid) in by_org:
        return by_org[int(oid)]
    return None


def candidates(deals: list[dict]) -> list[dict]:
    robert = [
        d
        for d in deals
        if d.get("owner_id") == ROBERT_PD_OWNER and (d.get("add_time") or "") >= CUTOFF
    ]
    by_person, by_org = inbound_won_index(robert)
    out: list[dict] = []
    for d in robert:
        if d.get("pipeline_id") not in SECONDARY_PIPELINE_IDS:
            continue
        if (d.get("status") or "").lower() != "open":
            continue
        inn = counterpart(d, by_person, by_org)
        if not inn:
            continue
        out.append({"secondary": d, "inbound": inn})
    return out


def fetch_twenty_open() -> dict[str, dict]:
    filt = (
        f"ownerId[eq]:{ROBERT_TWENTY_OWNER},"
        "srcSystem[eq]:PIPEDRIVE_LEGACY,"
        "stage[in]:[NEW,CONTACTED,QUALIFIED,PROPOSAL,CONTRACT_SENT,PAYING]"
    )
    rows = paginate("opportunities", "opportunities", filt, user_agent=UA)
    return {str(r.get("pipedriveId")): r for r in rows if r.get("pipedriveId")}


def patch_won(opp_id: str, close_date: str | None) -> tuple[int, dict]:
    body: dict = {"stage": "WON"}
    if close_date:
        body["closeDate"] = close_date
    return http_json("PATCH", f"/opportunities/{opp_id}", body, user_agent=UA)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="20260804T065324Z")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--pace", type=float, default=0.25)
    args = ap.parse_args()
    load_env()

    run = resolve_run(args.run)
    stages = {s["id"]: s for s in load_json(run / "meta" / "stages.json")["data"]}
    pipes = {p["id"]: p["name"] for p in load_json(run / "meta" / "pipelines.json")["data"]}
    deals = load_deals(run)
    cands = candidates(deals)
    print(f"run={run.name} PD candidates (open secondary + inbound WON)={len(cands)}", flush=True)

    twenty = fetch_twenty_open()
    print(f"Twenty Robert open PIPEDRIVE_LEGACY={len(twenty)}", flush=True)

    plan: list[dict] = []
    missing_twenty = 0
    already_closed = 0
    for row in cands:
        sec = row["secondary"]
        inn = row["inbound"]
        pid = str(sec["id"])
        tw = twenty.get(pid)
        if not tw:
            missing_twenty += 1
            continue
        if tw.get("stage") not in OPEN_STAGES:
            already_closed += 1
            continue
        plan.append(
            {
                "pipedriveId": pid,
                "twentyId": tw["id"],
                "name": tw.get("name"),
                "twentyStage": tw.get("stage"),
                "legacyStage": tw.get("legacyPipedriveStageName")
                or stages.get(sec.get("stage_id"), {}).get("name"),
                "pdPipeline": pipes.get(sec.get("pipeline_id")),
                "inboundDealId": inn["id"],
                "inboundStage": stages.get(inn.get("stage_id"), {}).get("name"),
                "inboundWonTime": inn.get("won_time"),
                "closeDate": iso_close(inn.get("won_time") or inn.get("close_time")),
            }
        )

    by_from = Counter((p["legacyStage"], p["twentyStage"]) for p in plan)
    print(f"to_patch={len(plan)} missing_in_open_twenty={missing_twenty} already_not_open={already_closed}")
    print("breakdown (PD stage, Twenty stage → WON):")
    for k, v in by_from.most_common():
        print(f"  {v:3d}  {k[0]!r} / {k[1]} → WON")

    out_dir = run / "repair"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    manifest = out_dir / f"robert_inbound_stages_{stamp}_{'apply' if args.apply else 'dry'}.json"
    payload = {
        "run": run.name,
        "apply": bool(args.apply),
        "to_patch": len(plan),
        "breakdown": {f"{a} | {b}": n for (a, b), n in by_from.items()},
        "plan": plan,
    }
    manifest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"manifest {manifest}")

    if not args.apply:
        print("dry-run — nic nie zapisano. --apply żeby ustawić stage=WON.")
        return 0

    ok = 0
    err = 0
    errors: list[dict] = []
    for i, p in enumerate(plan, 1):
        st, res = patch_won(p["twentyId"], p["closeDate"])
        if st in (200, 201):
            ok += 1
        else:
            err += 1
            errors.append({"pipedriveId": p["pipedriveId"], "status": st, "error": res})
            print(f"  FAIL {p['pipedriveId']} {st} {res}", flush=True)
        if i % 20 == 0 or i == len(plan):
            print(f"  patched {i}/{len(plan)} ok={ok} err={err}", flush=True)
        time.sleep(args.pace)

    result_path = out_dir / f"robert_inbound_stages_{stamp}_result.json"
    result_path.write_text(
        json.dumps({"ok": ok, "err": err, "errors": errors}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"DONE ok={ok} err={err} {result_path}")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
