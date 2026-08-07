#!/usr/bin/env python3
"""Eksport Pipedrive → lokalny staging (krok 11).

Źródło prawdy: API v2 (+ v1 tam, gdzie trzeba na słowniki).
Zakres wieku: add_time >= cutoff (domyślnie 3 lata wstecz).
Pull szeroki (całe konto), oznaczenia owner-map / in_scope w summary.

Użycie:
  python3 integrations/tools/pipedrive_export_staging.py
  python3 integrations/tools/pipedrive_export_staging.py --cutoff 2023-08-04
  python3 integrations/tools/pipedrive_export_staging.py --entities deals,persons --max-pages 2  # smoke

Wymaga PIPEDRIVE_API_TOKEN w .env.local.
Wynik: integrations/pipedrive-staging/runs/<timestamp>/
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
STAGING_ROOT = REPO_ROOT / "integrations" / "pipedrive-staging" / "runs"
USER_AGENT = "owocni-pipedrive-export/1.0"

# PD user id → Twenty WorkspaceMember (checklist 2026-08-04)
OWNER_MAP = {
    15403616: {
        "pd_name": "Robert",
        "twenty_name": "Robert Mańk",
        "twenty_member_id": "23ac9976-0232-4097-b056-5dc391bf7c34",
        "twenty_email": "robertmank@owocni.pl",
    },
    15355029: {
        "pd_name": "Krzysztof Gilowski",
        "twenty_name": "Ewa Malanowska",
        "twenty_member_id": "b9e2b31e-0b4a-4936-9d2a-2e5b4a3e0b16",
        "twenty_email": "ewamalanowska@owocni.pl",
    },
    25871714: {
        "pd_name": "Kamil",
        "twenty_name": "Owocni Owocni (Mariusz / ogólne)",
        "twenty_member_id": "2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d",
        "twenty_email": "owocni@gmail.com",
    },
    20546251: {
        "pd_name": "Patryk Sławicki",
        "twenty_name": "Owocni Owocni (Mariusz / ogólne)",
        "twenty_member_id": "2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d",
        "twenty_email": "owocni@gmail.com",
    },
}

FALLBACK_OWNER = {
    "twenty_name": "Owocni Owocni (Mariusz / ogólne)",
    "twenty_member_id": "2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d",
    "twenty_email": "owocni@gmail.com",
}


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


def token() -> str:
    t = os.environ.get("PIPEDRIVE_API_TOKEN", "").strip()
    if not t:
        raise SystemExit("Brak PIPEDRIVE_API_TOKEN")
    return t


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, obj: object) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
    path.write_bytes(raw)
    return sha256_bytes(raw)


def pd_get(path: str, params: dict | None = None, *, version: str = "v2") -> dict:
    params = dict(params or {})
    params["api_token"] = token()
    if version == "v2":
        url = f"https://api.pipedrive.com/api/v2{path}?{urllib.parse.urlencode(params)}"
    else:
        url = f"https://api.pipedrive.com/v1{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
        method="GET",
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            if e.code == 429 and attempt < 5:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"GET {path} HTTP {e.code}: {body}") from e
    raise RuntimeError(f"GET {path} failed after retries")


def paginate_v2(path: str, params: dict | None = None, *, max_pages: int | None = None):
    """Yield (page_index, rows, raw_response)."""
    cursor = None
    page = 0
    base = dict(params or {})
    base.setdefault("limit", 100)
    while True:
        p = dict(base)
        if cursor:
            p["cursor"] = cursor
        raw = pd_get(path, p, version="v2")
        rows = raw.get("data") or []
        yield page, rows, raw
        page += 1
        if max_pages is not None and page >= max_pages:
            break
        cursor = (raw.get("additional_data") or {}).get("next_cursor")
        if not cursor or not rows:
            break
        time.sleep(0.05)


def paginate_v1(path: str, params: dict | None = None, *, max_pages: int | None = None):
    start = 0
    limit = 100
    page = 0
    base = dict(params or {})
    while True:
        p = dict(base)
        p["start"] = start
        p["limit"] = limit
        raw = pd_get(path, p, version="v1")
        rows = raw.get("data") or []
        if rows is None:
            rows = []
        yield page, rows, raw
        page += 1
        if max_pages is not None and page >= max_pages:
            break
        more = (raw.get("additional_data") or {}).get("pagination") or {}
        if not more.get("more_items_in_collection"):
            break
        start = more.get("next_start", start + limit)
        time.sleep(0.05)


def in_age_window(add_time: str | None, cutoff_iso: str) -> bool:
    if not add_time:
        return False
    return add_time[:19] >= cutoff_iso[:19]


def resolve_owner(owner_id: int | None) -> dict:
    if owner_id in OWNER_MAP:
        return {"scope_reason": "owned_by_mapped_rep", **OWNER_MAP[owner_id]}
    return {"scope_reason": "fallback_unmapped", "pd_owner_id": owner_id, **FALLBACK_OWNER}


def export_singleton(run_dir: Path, name: str, path: str, *, version: str = "v2") -> dict:
    raw = pd_get(path, version=version)
    rel = Path("meta") / f"{name}.json"
    digest = write_json(run_dir / rel, raw)
    n = len(raw.get("data") or []) if isinstance(raw.get("data"), list) else 1
    return {"file": str(rel), "sha256": digest, "count": n, "endpoint": path, "version": version}


def export_collection(
    run_dir: Path,
    folder: str,
    path: str,
    *,
    version: str = "v2",
    params: dict | None = None,
    max_pages: int | None = None,
    cutoff_iso: str | None = None,
    age_field: str = "add_time",
) -> dict:
    out_dir = run_dir / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    in_scope = 0
    pages = 0
    page_files: list[dict] = []
    iterator = paginate_v2 if version == "v2" else paginate_v1
    for page_idx, rows, raw in iterator(path, params, max_pages=max_pages):
        # annotate rows lightly for later transform (don't mutate API purity — save side index)
        annotated = []
        for row in rows:
            item = dict(row)
            at = item.get(age_field)
            age_ok = in_age_window(at, cutoff_iso) if cutoff_iso else True
            owner_id = item.get("owner_id")
            owner_meta = resolve_owner(owner_id if isinstance(owner_id, int) else None)
            item["_export"] = {
                "in_age_window": age_ok,
                "owner_map": owner_meta,
            }
            if age_ok:
                in_scope += 1
            annotated.append(item)
        payload = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "endpoint": path,
            "version": version,
            "page": page_idx,
            "params": params or {},
            "additional_data": raw.get("additional_data"),
            "success": raw.get("success"),
            "data": annotated,
        }
        rel = Path(folder) / f"page_{page_idx:04d}.json"
        digest = write_json(run_dir / rel, payload)
        page_files.append({"file": str(rel), "sha256": digest, "count": len(annotated)})
        total += len(annotated)
        pages += 1
        print(f"  {folder} page {page_idx}: {len(annotated)} (total {total})")
    return {
        "folder": folder,
        "endpoint": path,
        "version": version,
        "pages": pages,
        "total": total,
        "in_age_window": in_scope,
        "page_files": page_files,
    }


def default_cutoff(days: int = 365 * 3) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT00:00:00Z")


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Export Pipedrive → staging")
    parser.add_argument("--cutoff", default=None, help="ISO date/time lower bound for add_time (default: 3y)")
    parser.add_argument(
        "--entities",
        default="meta,deals,persons,organizations,activities,notes,pipelines,stages",
        help="Comma list",
    )
    parser.add_argument("--max-pages", type=int, default=None, help="Cap pages per collection (smoke)")
    args = parser.parse_args()
    cutoff = args.cutoff or default_cutoff()
    wanted = {e.strip() for e in args.entities.split(",") if e.strip()}

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = STAGING_ROOT / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    print(f"Run dir: {run_dir}")
    print(f"Cutoff add_time >= {cutoff}")

    manifest: dict = {
        "run_id": run_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "cutoff": cutoff,
        "owner_map": OWNER_MAP,
        "fallback_owner": FALLBACK_OWNER,
        "entities": {},
    }
    write_json(run_dir / "owner_map.json", {"owner_map": OWNER_MAP, "fallback": FALLBACK_OWNER})

    if "meta" in wanted or "pipelines" in wanted or "stages" in wanted:
        print("=== meta / dictionaries ===")
        # users: v1 reliable
        manifest["entities"]["users"] = export_singleton(run_dir, "users", "/users", version="v1")
        try:
            manifest["entities"]["pipelines"] = export_singleton(run_dir, "pipelines", "/pipelines", version="v2")
        except RuntimeError:
            manifest["entities"]["pipelines"] = export_singleton(run_dir, "pipelines", "/pipelines", version="v1")
        try:
            manifest["entities"]["stages"] = export_singleton(run_dir, "stages", "/stages", version="v2")
        except RuntimeError:
            manifest["entities"]["stages"] = export_singleton(run_dir, "stages", "/stages", version="v1")
        try:
            manifest["entities"]["activityTypes"] = export_singleton(
                run_dir, "activityTypes", "/activityTypes", version="v1"
            )
        except RuntimeError as e:
            print("  activityTypes skip:", e)
        for label, path in (
            ("dealFields", "/dealFields"),
            ("personFields", "/personFields"),
            ("organizationFields", "/organizationFields"),
        ):
            try:
                manifest["entities"][label] = export_singleton(run_dir, label, path, version="v1")
            except RuntimeError as e:
                print(f"  {label} skip:", e)

    if "deals" in wanted:
        print("=== deals ===")
        manifest["entities"]["deals"] = export_collection(
            run_dir,
            "deals",
            "/deals",
            version="v2",
            max_pages=args.max_pages,
            cutoff_iso=cutoff,
        )

    if "persons" in wanted:
        print("=== persons ===")
        manifest["entities"]["persons"] = export_collection(
            run_dir,
            "persons",
            "/persons",
            version="v2",
            max_pages=args.max_pages,
            cutoff_iso=cutoff,
        )

    if "organizations" in wanted:
        print("=== organizations ===")
        manifest["entities"]["organizations"] = export_collection(
            run_dir,
            "organizations",
            "/organizations",
            version="v2",
            max_pages=args.max_pages,
            cutoff_iso=cutoff,
        )

    if "activities" in wanted:
        print("=== activities ===")
        manifest["entities"]["activities"] = export_collection(
            run_dir,
            "activities",
            "/activities",
            version="v2",
            max_pages=args.max_pages,
            cutoff_iso=cutoff,
        )

    if "notes" in wanted:
        print("=== notes (v1) ===")
        try:
            manifest["entities"]["notes"] = export_collection(
                run_dir,
                "notes",
                "/notes",
                version="v1",
                max_pages=args.max_pages,
                cutoff_iso=cutoff,
                age_field="add_time",
            )
        except RuntimeError as e:
            print("  notes failed:", e)
            manifest["entities"]["notes"] = {"error": str(e)}

    manifest["finished_at"] = datetime.now(timezone.utc).isoformat()
    # summary counts
    summary = {
        "run_id": run_id,
        "cutoff": cutoff,
        "counts": {
            k: {
                "total": v.get("total", v.get("count")),
                "in_age_window": v.get("in_age_window"),
                "pages": v.get("pages"),
            }
            for k, v in manifest["entities"].items()
            if isinstance(v, dict)
        },
    }
    write_json(run_dir / "summary.json", summary)
    digest = write_json(run_dir / "manifest.json", manifest)
    print("\n=== DONE ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"manifest sha256: {digest}")
    print(f"path: {run_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
