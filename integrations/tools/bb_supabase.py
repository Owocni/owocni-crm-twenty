#!/usr/bin/env python3
"""Read-only helpers for Better Bitrix Supabase (crm.owocni.pl/lead)."""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

BB_ROOT = Path(__file__).resolve().parents[2].parent / "better-bitrix-main"

CLOSED_STAGES = frozenset({"lead_won", "lead_lost"})
DEFAULT_PIPELINE_EXCLUDE = frozenset({"service"})

OWNER_TWENTY = {
    257: "ccac533d-a34b-4cfc-a036-9e75ee3f8910",  # Gosia
    259: "4704e0c0-8d77-4640-ad1e-1875294294df",  # Marta
    79: "7fddba1d-e443-47d4-97b7-a3a829efd8c1",  # Maciej
}

OWNER_LABEL = {257: "Gosia", 259: "Marta", 79: "Maciej"}


def load_bb_env() -> None:
    env_path = BB_ROOT / ".env"
    if not env_path.is_file():
        if os.environ.get("BB_SUPABASE_URL") and os.environ.get("BB_SUPABASE_SERVICE_KEY"):
            return
        raise SystemExit(f"Missing {env_path} and BB_SUPABASE_* env")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        k = key.strip()
        v = value.strip().strip('"').strip("'")
        if k == "NEXT_PUBLIC_SUPABASE_URL":
            os.environ.setdefault("BB_SUPABASE_URL", v)
        elif k == "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY":
            os.environ.setdefault("BB_SUPABASE_SERVICE_KEY", v)


def bb_headers() -> dict[str, str]:
    key = os.environ.get("BB_SUPABASE_SERVICE_KEY", "").strip()
    if not key:
        raise SystemExit("Brak BB_SUPABASE_SERVICE_KEY")
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def bb_get(path: str, *, params: dict[str, str] | None = None) -> list[dict]:
    base = os.environ.get("BB_SUPABASE_URL", "").rstrip("/")
    qs = urllib.parse.urlencode(params or {}, safe="(),.")
    url = f"{base}/rest/v1/{path}" + (f"?{qs}" if qs else "")
    req = urllib.request.Request(url, headers=bb_headers())
    with urllib.request.urlopen(req, timeout=180) as res:
        data = json.loads(res.read().decode())
    return data if isinstance(data, list) else []


def company_emails(company: dict | None) -> list[str]:
    if not company or not isinstance(company, dict):
        return []
    out: list[str] = []
    for e in company.get("emails") or []:
        if isinstance(e, str) and "@" in e:
            out.append(e.strip().lower())
    return out


def company_phones(company: dict | None) -> list[str]:
    if not company or not isinstance(company, dict):
        return []
    out: list[str] = []
    for p in company.get("phones") or []:
        if isinstance(p, str) and p.strip():
            out.append(p.strip())
    return out


def fetch_bb_leads(
    *,
    owner_ids: list[int] | None = None,
    modified_since: str | None = None,
    days: int = 30,
    exclude_stages: frozenset[str] | None = DEFAULT_PIPELINE_EXCLUDE,
    include_closed: bool = False,
) -> list[dict]:
    """Active pipeline leads from leads_extended_view.

    Use the live view, not leads_extended_materialized: the MV lags new
    form leads (e.g. 9388/9389 on 2026-09-12), so flag sync treated them
    as Sortownia-without-BB and cleared isFollowUp.
    """
    load_bb_env()
    owner_ids = owner_ids or list(OWNER_TWENTY.keys())
    ids = ",".join(str(i) for i in owner_ids)

    params: dict[str, str] = {
        "assigned_user_id": f"in.({ids})",
        "is_archived": "eq.false",
        "select": (
            "id,title,stage_name,assigned_user_id,primary_product,created_at,"
            "last_modified_at,company,engagement,is_follow_up"
        ),
        "order": "last_modified_at.desc",
    }
    if not include_closed:
        params["stage_name"] = f"not.in.({','.join(sorted(CLOSED_STAGES))})"
    if modified_since:
        params["last_modified_at"] = f"gte.{modified_since}"
    elif days > 0:
        from datetime import datetime, timedelta, timezone

        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")
        params["last_modified_at"] = f"gte.{since}"

    rows = bb_get("leads_extended_view", params=params)
    if exclude_stages:
        rows = [r for r in rows if (r.get("stage_name") or "") not in exclude_stages]
    for r in rows:
        r["emails"] = company_emails(r.get("company"))
        r["phones"] = company_phones(r.get("company"))
        r["owner_label"] = OWNER_LABEL.get(r.get("assigned_user_id"), "?")
        r["bitrix_deal_id"] = f"bb:{r['id']}"
    return rows
