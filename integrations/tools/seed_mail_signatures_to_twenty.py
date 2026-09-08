#!/usr/bin/env python3
"""Seed mailSignature records from Owocni Mail defaults into Twenty.

Idempotent: skips a row when mailboxHandle already exists.
Requires the mailSignature object (Owocni Mail ≥ 0.1.86) and TWENTY_API_KEY.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SIGNATURE_TS = (
    REPO_ROOT
    / "apps/owocni-mail-twenty/src/utils/mailSignature.ts"
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


def rest(method: str, path: str, payload: dict | None = None, retries: int = 10) -> dict:
    api_key = os.environ["TWENTY_API_KEY"]
    base = os.environ.get("TWENTY_REST_URL", "https://api.twenty.com/rest").rstrip("/")
    last_error: Exception | None = None

    for attempt in range(retries):
        request = urllib.request.Request(
            f"{base}{path}",
            data=json.dumps(payload).encode("utf-8") if payload else None,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "owocni-seed-mail-signatures/1.0",
            },
            method=method,
        )

        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                body = response.read()
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:800]
            last_error = RuntimeError(f"{method} {path} -> HTTP {exc.code}: {detail}")
            if exc.code in (429, 502, 503) and attempt < retries - 1:
                wait = min(90, 5 * (2**attempt))
                print(f"  retry {attempt + 1}/{retries} after {wait}s (HTTP {exc.code})")
                time.sleep(wait)
                continue
            raise last_error from exc

    raise last_error or RuntimeError(f"{method} {path} failed")


def parse_defaults() -> list[dict]:
    text = SIGNATURE_TS.read_text(encoding="utf-8")
    consts: dict[str, str] = {}
    for match in re.finditer(
        r"const ([A-Z_]+_HTML)\s*=\s*'((?:\\'|[^'])*)'",
        text,
    ):
        consts[match.group(1)] = match.group(2).replace("\\'", "'")

    records_match = re.search(
        r"export const DEFAULT_SIGNATURE_RECORDS[^=]*=\s*\[(.*?)\];",
        text,
        re.S,
    )
    if not records_match:
        raise SystemExit("DEFAULT_SIGNATURE_RECORDS not found in mailSignature.ts")

    records: list[dict] = []
    for block in re.finditer(
        r"name:\s*'((?:\\'|[^'])*)'\s*,\s*"
        r"mailboxHandle:\s*'((?:\\'|[^'])*)'\s*,\s*"
        r"bodyHtml:\s*([A-Z_]+_HTML)",
        records_match.group(1),
    ):
        const_name = block.group(3)
        html = consts.get(const_name)
        if html is None:
            raise SystemExit(f"Missing HTML const {const_name}")
        records.append(
            {
                "name": block.group(1).replace("\\'", "'"),
                "mailboxHandle": block.group(2),
                "bodyHtml": html,
            }
        )

    if not records:
        raise SystemExit("No signature records parsed from mailSignature.ts")

    return records


def existing_handles() -> set[str]:
    try:
        payload = rest("GET", "/mailSignatures?limit=200")
    except RuntimeError as exc:
        if "404" in str(exc):
            raise SystemExit(
                "mailSignatures 404 — najpierw deploy Owocni Mail 0.1.86 "
                "(obiekt Stopki maili)."
            ) from exc
        raise

    records = payload.get("data", {}).get("mailSignatures", [])
    if not isinstance(records, list):
        return set()

    return {
        str(record.get("mailboxHandle") or "").strip().lower()
        for record in records
        if record.get("mailboxHandle")
    }


def main() -> None:
    load_env()

    if not os.environ.get("TWENTY_API_KEY"):
        raise SystemExit("TWENTY_API_KEY is empty in .env.local")

    defaults = parse_defaults()
    existing = existing_handles()
    created = 0
    skipped = 0

    for row in defaults:
        handle = row["mailboxHandle"].strip().lower()
        if handle in existing:
            skipped += 1
            print(f"  SKIP {row['name']} ({handle})")
            continue

        payload = {
            "name": row["name"],
            "mailboxHandle": row["mailboxHandle"],
            "bodyHtml": {"markdown": row["bodyHtml"]},
            "isActive": True,
        }

        try:
            response = rest("POST", "/mailSignatures", payload)
            record = (
                response.get("data", {}).get("createMailSignature")
                or response.get("data", {}).get("mailSignature")
                or response.get("data", response)
            )
            twenty_id = record.get("id") if isinstance(record, dict) else None
            created += 1
            print(f"  OK   {row['name']} -> {twenty_id}")
        except RuntimeError as exc:
            print(f"  ERR  {row['name']}: {exc}")

        time.sleep(1.0)

    print(f"\nDone: created={created}, skipped={skipped}, total={len(defaults)}")


if __name__ == "__main__":
    main()
