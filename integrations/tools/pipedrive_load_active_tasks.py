#!/usr/bin/env python3
"""Load active Pipedrive activities → Twenty Tasks (Robert / Krzysztof→Ewa only).

Filtry:
  - in_age_window
  - done=false
  - type ≠ call (PBX)
  - owner ∈ {Robert, Krzysztof Gilowski}

Użycie:
  python3 integrations/tools/pipedrive_load_active_tasks.py --run 20260804T065324Z --dry-run
  python3 integrations/tools/pipedrive_load_active_tasks.py --run 20260804T065324Z
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
USER_AGENT = "owocni-pipedrive-active-tasks/1.0"

# PD user ids from owner_map (Robert + Krzysztof only)
ALLOWED_PD_OWNERS = frozenset({15403616, 15355029})
SKIP_TYPES = frozenset({"call"})


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


def extract_id(collection: str, payload: dict) -> str | None:
    data = payload.get("data") or {}
    singular = collection.rstrip("s")
    for key in (collection, singular, f"create{singular[:1].upper()}{singular[1:]}"):
        node = data.get(key)
        if isinstance(node, dict) and node.get("id"):
            return node["id"]
        if isinstance(node, list) and node and isinstance(node[0], dict):
            return node[0].get("id")
    for k, v in data.items():
        if isinstance(v, dict) and v.get("id") and str(k).lower().startswith("create"):
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


def strip_html(raw: str | None) -> str:
    if not raw:
        return ""
    text = unescape(re.sub(r"<[^>]+>", " ", raw))
    return re.sub(r"\s+", " ", text).strip()


def due_at(activity: dict) -> str | None:
    d = activity.get("due_date")
    if not d:
        return None
    t = activity.get("due_time") or "12:00"
    if len(t) == 5:
        t = t + ":00"
    # PD due is local-ish; store as UTC noon-ish ISO
    return f"{d}T{t}.000Z"


def find_by_pipedrive(collection: str, pd_id: str) -> str | None:
    filt = urllib.parse.quote(f"pipedriveId[eq]:{pd_id}", safe="")
    st, payload = http_json("GET", f"/{collection}?filter={filt}&limit=1")
    if st != 200:
        return None
    rows = (payload.get("data") or {}).get(collection) or []
    return rows[0]["id"] if rows else None


def load_done(progress: Path) -> set[int]:
    done: set[int] = set()
    if not progress.is_file():
        return done
    for line in progress.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        aid = o.get("activity_id")
        if aid is not None and o.get("task_id") and not o.get("error"):
            done.add(int(aid))
    return done


def append_progress(progress: Path, row: dict) -> None:
    with progress.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def select_activities(run: Path) -> list[dict]:
    out: list[dict] = []
    for a in load_pages(run / "activities"):
        if not (a.get("_export") or {}).get("in_age_window"):
            continue
        if a.get("done"):
            continue
        typ = (a.get("type") or "").lower()
        if typ in SKIP_TYPES:
            continue
        owner = a.get("owner_id")
        if isinstance(owner, dict):
            owner = owner.get("id") or owner.get("value")
        if owner is None or int(owner) not in ALLOWED_PD_OWNERS:
            continue
        out.append(a)
    out.sort(key=lambda x: x.get("due_date") or x.get("add_time") or "")
    return out


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run = resolve_run(args.run)
    out_dir = run / "tasks"
    out_dir.mkdir(parents=True, exist_ok=True)
    progress = out_dir / "progress.jsonl"

    owner_map = json.loads((run / "owner_map.json").read_text(encoding="utf-8")).get(
        "owner_map"
    ) or {}

    activities = select_activities(run)
    done = load_done(progress)
    todo = [a for a in activities if int(a["id"]) not in done]
    print(
        f"Run={run.name} active Robert/Krzysztof non-call={len(activities)} "
        f"todo={len(todo)} dry_run={args.dry_run}"
    )

    results: list[dict] = []
    ok = err = 0
    for i, a in enumerate(todo, 1):
        aid = int(a["id"])
        owner_pd = int(a["owner_id"])
        om = owner_map.get(str(owner_pd)) or {}
        assignee = om.get("twenty_member_id")
        subject = (a.get("subject") or f"PD activity {aid}").strip()[:500]
        typ = a.get("type") or "?"
        note = strip_html(a.get("note"))
        body_parts = [
            f"pipedriveActivityId: {aid}",
            f"type: {typ}",
            f"ex-owner PD: {om.get('pd_name') or owner_pd}",
        ]
        if note:
            body_parts.append("")
            body_parts.append(note[:3500])
        body = "\n".join(body_parts)

        deal_id = a.get("deal_id")
        person_id = a.get("person_id")
        if isinstance(deal_id, dict):
            deal_id = deal_id.get("value") or deal_id.get("id")
        if isinstance(person_id, dict):
            person_id = person_id.get("value") or person_id.get("id")

        row: dict = {
            "activity_id": aid,
            "type": typ,
            "subject": subject,
            "owner_pd": owner_pd,
            "owner_pd_name": om.get("pd_name"),
            "assigneeId": assignee,
            "deal_id": deal_id,
            "person_id": person_id,
            "dueAt": due_at(a),
        }
        print(
            f"[{i}/{len(todo)}] PD#{aid} {typ} owner={om.get('pd_name')} "
            f"deal={deal_id} → {subject!r}"
        )

        if args.dry_run:
            results.append(row)
            continue

        task_body: dict = {
            "title": subject,
            "status": "TODO",
            "bodyV2": {"markdown": body},
        }
        if assignee:
            task_body["assigneeId"] = assignee
        if row["dueAt"]:
            task_body["dueAt"] = row["dueAt"]

        st, res = http_json("POST", "/tasks", task_body)
        task_id = extract_id("tasks", res) if st in (200, 201) else None
        row["task_create_status"] = st
        row["task_id"] = task_id
        if not task_id:
            row["error"] = res.get("error")
            print(f"  FAIL task {st} {res.get('error')}")
            err += 1
            results.append(row)
            append_progress(progress, row)
            time.sleep(0.6)
            continue
        print(f"  task {task_id}")
        time.sleep(0.55)

        # Link to Opportunity (prefer) and/or Person
        linked = False
        if deal_id:
            opp_id = find_by_pipedrive("opportunities", str(deal_id))
            time.sleep(0.35)
            if opp_id:
                st2, _ = http_json(
                    "POST",
                    "/taskTargets",
                    {"taskId": task_id, "targetOpportunityId": opp_id},
                )
                row["target_opportunity_id"] = opp_id
                row["target_opp_status"] = st2
                linked = st2 in (200, 201)
                print(f"  target opp={opp_id} status={st2}")
                time.sleep(0.45)
        if person_id and (not linked or not deal_id):
            pe_id = find_by_pipedrive("people", str(person_id))
            time.sleep(0.35)
            if pe_id:
                st3, _ = http_json(
                    "POST",
                    "/taskTargets",
                    {"taskId": task_id, "targetPersonId": pe_id},
                )
                row["target_person_id"] = pe_id
                row["target_person_status"] = st3
                print(f"  target person={pe_id} status={st3}")
                time.sleep(0.45)

        ok += 1
        results.append(row)
        append_progress(progress, row)

    summary = {
        "run_id": run.name,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "selected": len(activities),
        "todo": len(todo),
        "ok": ok,
        "errors": err,
        "by_owner": {},
    }
    from collections import Counter

    summary["by_owner"] = dict(
        Counter((r.get("owner_pd_name") or r.get("owner_pd")) for r in results)
    )
    summary["by_type"] = dict(Counter(r.get("type") for r in results))
    (out_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    if args.dry_run:
        (out_dir / "dry_run.json").write_text(
            json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    print("\n=== DONE ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"Artefacts: {out_dir}")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
