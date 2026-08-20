#!/usr/bin/env python3
"""Create CallTranscript.person („Rozmówca") → Person relation (MANY_TO_ONE).

Idempotent: if field `person` already exists as RELATION → OK; if other type → abort.

Usage:
  export TWENTY_API_KEY=eyJ...
  python3 integrations/tools/deploy_call_transcript_rozmowca_field.py

Requires Metadata API (User-Agent header — Cloudflare 1010 without it).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
METADATA_URL = os.environ.get("TWENTY_METADATA_URL", "https://api.twenty.com/metadata")
USER_AGENT = "owocni-crm-deploy-rozmowca-field/1.0"

FIELD_NAME = "person"
FIELD_LABEL = "Rozmówca"
REVERSE_LABEL = "Rozmowy"
REVERSE_ICON = "IconPhone"


def load_dotenv_local() -> None:
    for env_path in (
        REPO_ROOT / ".env.local",
        REPO_ROOT / "integrations" / "cloud-functions" / "twenty-crm-worker" / ".env.deploy",
    ):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def gql(query: str, variables: dict | None = None) -> dict:
    token = os.environ.get("TWENTY_API_KEY", "").strip()
    if not token:
        print("Błąd: brak TWENTY_API_KEY", file=sys.stderr)
        sys.exit(2)
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
    with urllib.request.urlopen(req, timeout=60) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    if out.get("errors"):
        raise RuntimeError(json.dumps(out["errors"], ensure_ascii=False))
    return out


def object_ids() -> dict[str, str]:
    data = gql(
        """
        query {
          objects(paging: { first: 100 }) {
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
              node { id name type label }
            }
          }
        }
        """,
        {"id": object_id},
    )
    return {e["node"]["name"]: e["node"] for e in data["data"]["fields"]["edges"]}


def main() -> None:
    load_dotenv_local()
    ids = object_ids()
    ct_id = ids.get("callTranscript")
    person_id = ids.get("person")
    if not ct_id or not person_id:
        raise SystemExit("Brak obiektu callTranscript lub person w Metadata")

    fields = fields_for(ct_id)
    existing = fields.get(FIELD_NAME)
    if existing:
        if existing["type"] != "RELATION":
            raise SystemExit(
                f"Pole `{FIELD_NAME}` już istnieje jako {existing['type']} "
                f"(id={existing['id']}) — nie nadpisuję"
            )
        print(f"OK — pole `{FIELD_NAME}` już istnieje ({existing['id']})")
        return

    data = gql(
        """
        mutation CreateField($input: CreateOneFieldMetadataInput!) {
          createOneField(input: $input) { id name type label }
        }
        """,
        {
            "input": {
                "field": {
                    "type": "RELATION",
                    "name": FIELD_NAME,
                    "label": FIELD_LABEL,
                    "description": "Osoba, z którą była rozmowa (klient)",
                    "icon": "IconUser",
                    "objectMetadataId": ct_id,
                    "isNullable": True,
                    "isUnique": False,
                    "isLabelSyncedWithName": False,
                    "relationCreationPayload": {
                        "type": "MANY_TO_ONE",
                        "targetObjectMetadataId": person_id,
                        "targetFieldLabel": REVERSE_LABEL,
                        "targetFieldIcon": REVERSE_ICON,
                    },
                }
            }
        },
    )
    created = data["data"]["createOneField"]
    print(
        f"Utworzono relację „{FIELD_LABEL}”: "
        f"id={created['id']} name={created['name']} type={created['type']}"
    )


if __name__ == "__main__":
    main()
