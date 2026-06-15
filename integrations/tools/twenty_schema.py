#!/usr/bin/env python3
"""Twenty Metadata API — audyt i eksport schemy z DATA_MODEL.md.

Użycie:
  export TWENTY_API_KEY=eyJ...   # lub plik .env.local w root repo
  python3 integrations/tools/twenty_schema.py audit
  python3 integrations/tools/twenty_schema.py audit --object opportunity
  python3 integrations/tools/twenty_schema.py export

Wymaga: Python 3.9+, brak zewnętrznych pakietów.
Uwaga: Metadata API wymaga nagłówka User-Agent (Cloudflare 1010 bez niego).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
METADATA_URL = os.environ.get("TWENTY_METADATA_URL", "https://api.twenty.com/metadata")
SNAPSHOT_PATH = REPO_ROOT / "owocni-crm" / "generated" / "twenty-schema.snapshot.json"
USER_AGENT = "owocni-crm-twenty-schema/1.0"

# Pola FROZEN z DATA_MODEL.md §5.1–5.2 (Etap 1.1)
REQUIRED_OPPORTUNITY = {
    "idOid", "stage", "campaignRejected", "rejectionReason",
    "bizProduct", "bizSource", "bizValueWon", "srcSystem",
    "lastOrchestrationEventAt", "lastOrchestrationEventId", "bitrixDealId",
}
REQUIRED_PERSON = {"idOid"}
STAGE_VALUES = {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"}


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


def gql(query: str, variables: dict | None = None) -> dict:
    token = os.environ.get("TWENTY_API_KEY", "").strip()
    if not token:
        print("Błąd: brak TWENTY_API_KEY. Ustaw w .env.local lub export.", file=sys.stderr)
        sys.exit(2)
    body = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(
        METADATA_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_object_ids() -> dict[str, str]:
    data = gql(
        """
        query Objects {
          objects(paging: { first: 50 }) {
            edges { node { id nameSingular } }
          }
        }
        """
    )
    if data.get("errors"):
        print(json.dumps(data["errors"], indent=2), file=sys.stderr)
        sys.exit(1)
    return {e["node"]["nameSingular"]: e["node"]["id"] for e in data["data"]["objects"]["edges"]}


def fetch_fields_for_object(object_id: str) -> list[dict]:
    data = gql(
        """
        query Fields($id: UUID!) {
          fields(filter: { objectMetadataId: { eq: $id } }, paging: { first: 200 }) {
            edges {
              node {
                id
                name
                type
                label
                description
                isUnique
                options
              }
            }
          }
        }
        """,
        {"id": object_id},
    )
    if data.get("errors"):
        print(json.dumps(data["errors"], indent=2), file=sys.stderr)
        sys.exit(1)
    return [e["node"] for e in data["data"]["fields"]["edges"]]


def fetch_objects() -> list[dict]:
    ids = fetch_object_ids()
    objects: list[dict] = []
    for name in ("opportunity", "person"):
        if name not in ids:
            continue
        objects.append(
            {
                "id": ids[name],
                "nameSingular": name,
                "fields": {"edges": [{"node": f} for f in fetch_fields_for_object(ids[name])]},
            }
        )
    return objects


def audit_object(obj: dict) -> int:
    name = obj["nameSingular"]
    fields = {f["node"]["name"]: f["node"] for f in obj["fields"]["edges"]}
    print(f"\n=== {name} (objectId={obj['id']}) ===")
    required = REQUIRED_OPPORTUNITY if name == "opportunity" else REQUIRED_PERSON if name == "person" else set()
    missing = sorted(required - set(fields.keys()))
    extra_custom = sorted(
        n for n in fields
        if n not in required and n not in {"name", "amount", "closeDate", "probability", "company", "pointOfContact", "stage", "createdAt", "updatedAt", "deletedAt", "createdBy", "position", "searchVector"}
    )
    if missing:
        print("  BRAKUJE:", ", ".join(missing))
    else:
        print("  Pola wymagane: OK")
    for fname in sorted(required & set(fields.keys())):
        f = fields[fname]
        print(f"  - {fname}: type={f['type']} unique={f.get('isUnique')}")
    if name == "opportunity" and "stage" in fields:
        opts = fields["stage"].get("options") or []
        vals = {o.get("value") for o in opts}
        bad = vals - STAGE_VALUES
        miss_stage = STAGE_VALUES - vals
        print(f"  stage values: {sorted(vals)}")
        if miss_stage:
            print("  stage BRAKUJE:", sorted(miss_stage))
        if bad:
            print("  stage NADMIAR (legacy?):", sorted(bad))
    if extra_custom:
        print("  Inne custom:", ", ".join(extra_custom[:15]))
    return len(missing)


def cmd_audit(filter_object: str | None) -> int:
    load_dotenv_local()
    objects = fetch_objects()
    total_missing = 0
    for obj in objects:
        if filter_object and obj["nameSingular"] != filter_object:
            continue
        if obj["nameSingular"] in ("opportunity", "person"):
            total_missing += audit_object(obj)
    if total_missing:
        print(f"\nWynik: {total_missing} brakujących pól — uruchom sync (w przygotowaniu) lub agent z API.")
        return 1
    print("\nWynik: schema zgodna z DATA_MODEL (audit PASS).")
    return 0


def cmd_export() -> int:
    load_dotenv_local()
    from datetime import datetime, timezone

    objects = fetch_objects()
    snapshot = {
        "_generated_at": datetime.now(timezone.utc).isoformat(),
        "_source": "integrations/tools/twenty_schema.py export",
        "_workspace": os.environ.get("TWENTY_WORKSPACE_URL", ""),
        "objects": {
            obj["nameSingular"]: {
                "objectId": obj["id"],
                "fields": {f["node"]["name"]: f["node"] for f in obj["fields"]["edges"]},
            }
            for obj in objects
        },
    }
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Zapisano: {SNAPSHOT_PATH}")
    return cmd_audit(None)


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("audit", "export"):
        print(__doc__)
        sys.exit(0)
    filt = None
    if "--object" in sys.argv:
        idx = sys.argv.index("--object")
        filt = sys.argv[idx + 1]
    if sys.argv[1] == "audit":
        sys.exit(cmd_audit(filt))
    if sys.argv[1] == "export":
        sys.exit(cmd_export())


if __name__ == "__main__":
    main()
