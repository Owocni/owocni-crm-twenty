#!/usr/bin/env python3
"""Deploy Pipedrive migration fields/options to Twenty Metadata API (idempotent).

Adds:
  - srcSystem option PIPEDRIVE_LEGACY (Opportunity)
  - bizSource option PIPEDRIVE_IMPORT (Opportunity)
  - pipedriveId TEXT on opportunity, person, company
  - legacyCreatedAt DATE_TIME + legacyPipedriveStageName TEXT on opportunity

Usage:
  python3 integrations/tools/deploy_pipedrive_migration_fields.py
"""
from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
METADATA_URL = os.environ.get("TWENTY_METADATA_URL", "https://api.twenty.com/metadata")
USER_AGENT = "owocni-deploy-pipedrive-fields/1.0"

COLORS = ["blue", "green", "orange", "purple", "red", "turquoise", "yellow", "gray", "pink", "sky"]


def load_dotenv_local() -> None:
    env_path = REPO_ROOT / ".env.local"
    if not env_path.is_file():
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
        raise SystemExit("Brak TWENTY_API_KEY")
    body: dict = {"query": query}
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
    with urllib.request.urlopen(req, timeout=90) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    if out.get("errors"):
        raise RuntimeError(json.dumps(out["errors"], ensure_ascii=False, indent=2))
    return out


def object_ids() -> dict[str, str]:
    data = gql(
        """
        query {
          objects(paging: { first: 50 }) {
            edges { node { id nameSingular } }
          }
        }
        """
    )
    return {
        e["node"]["nameSingular"]: e["node"]["id"]
        for e in data["data"]["objects"]["edges"]
    }


def fields_for(object_id: str) -> dict[str, dict]:
    data = gql(
        """
        query Fields($id: UUID!) {
          fields(filter: { objectMetadataId: { eq: $id } }, paging: { first: 200 }) {
            edges {
              node { id name type label description options isUnique isNullable }
            }
          }
        }
        """,
        {"id": object_id},
    )
    return {e["node"]["name"]: e["node"] for e in data["data"]["fields"]["edges"]}


def ensure_select_option(field: dict, value: str, label: str, color: str = "purple") -> None:
    opts = list(field.get("options") or [])
    if any(o.get("value") == value for o in opts):
        print(f"  OK option {field['name']}.{value} already present")
        return
    position = max((o.get("position") or 0) for o in opts) + 1 if opts else 0
    opts.append(
        {
            "id": str(uuid.uuid4()),
            "value": value,
            "label": label,
            "color": color,
            "position": position,
        }
    )
    gql(
        """
        mutation UpdateField($input: UpdateOneFieldMetadataInput!) {
          updateOneField(input: $input) { id name options }
        }
        """,
        {"input": {"id": field["id"], "update": {"options": opts}}},
    )
    print(f"  ADDED option {field['name']}.{value}")


def ensure_text_field(
    object_id: str,
    fields: dict[str, dict],
    name: str,
    label: str,
    description: str,
    *,
    field_type: str = "TEXT",
) -> None:
    if name in fields:
        print(f"  OK field {name} already present ({fields[name]['id']})")
        return
    data = gql(
        """
        mutation CreateField($input: CreateOneFieldMetadataInput!) {
          createOneField(input: $input) { id name type }
        }
        """,
        {
            "input": {
                "field": {
                    "type": field_type,
                    "name": name,
                    "label": label,
                    "description": description,
                    "objectMetadataId": object_id,
                    "isNullable": True,
                    "isUnique": False,
                    "isLabelSyncedWithName": False,
                }
            }
        },
    )
    created = data["data"]["createOneField"]
    print(f"  CREATED {name} type={created['type']} id={created['id']}")


def main() -> int:
    load_dotenv_local()
    ids = object_ids()
    for key in ("opportunity", "person", "company"):
        if key not in ids:
            raise SystemExit(f"Brak obiektu {key} w Metadata")

    print("=== Opportunity SELECT options ===")
    opp_fields = fields_for(ids["opportunity"])
    ensure_select_option(
        opp_fields["srcSystem"],
        "PIPEDRIVE_LEGACY",
        "Pipedrive Legacy",
        color="red",
    )
    # refresh after update
    opp_fields = fields_for(ids["opportunity"])
    ensure_select_option(
        opp_fields["bizSource"],
        "PIPEDRIVE_IMPORT",
        "Pipedrive import",
        color="purple",
    )

    print("=== pipedriveId ×3 ===")
    for obj in ("opportunity", "person", "company"):
        fmap = fields_for(ids[obj])
        ensure_text_field(
            ids[obj],
            fmap,
            "pipedriveId",
            "Pipedrive ID",
            "System ID z Pipedrive — most migracji + rollback. Unikalność egzekwowana w stagingu/adapterze.",
        )

    print("=== Opportunity legacy fields ===")
    opp_fields = fields_for(ids["opportunity"])
    ensure_text_field(
        ids["opportunity"],
        opp_fields,
        "legacyCreatedAt",
        "Legacy created at",
        "Oryginalny add_time z Pipedrive (audyt). Preferuj też createdAt=add_time przy imporcie.",
        field_type="DATE_TIME",
    )
    opp_fields = fields_for(ids["opportunity"])
    ensure_text_field(
        ids["opportunity"],
        opp_fields,
        "legacyPipedriveStageName",
        "Legacy Pipedrive stage",
        "Oryginalna nazwa stage/pipeline z Pipedrive, gdy nie ma 1:1 do Twenty stage.",
    )

    print("=== DONE ===")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(1)
