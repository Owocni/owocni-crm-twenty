#!/usr/bin/env python3
"""Deploy Lead Dispatcher v2.0 fields to Twenty Metadata API (idempotent).

Opportunity (CRM-only orchestration — never ad payloads):
  bizLeadIntentClass SELECT HOT_FIT / STANDARD / LOW_INTENT
  bizAssignedAt DATE_TIME
  bizAckAt DATE_TIME
  bizFirstAttemptAt DATE_TIME
  bizFirstAttemptChannel SELECT EMAIL / MANUAL
  bizFailoverCount NUMBER
  bizManagerAlertedAt DATE_TIME
  bizRoutingRule TEXT
  bizTimeOnPageMs NUMBER

Usage:
  python3 integrations/tools/deploy_lead_dispatcher_fields.py
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
USER_AGENT = "owocni-deploy-lead-dispatcher-fields/1.0"


def load_dotenv_local() -> None:
    for name in (".env.local", ".env"):
        env_path = REPO_ROOT / name
        if not env_path.is_file():
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
          objects(paging: { first: 80 }) {
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
          fields(filter: { objectMetadataId: { eq: $id } }, paging: { first: 250 }) {
            edges {
              node { id name type label description options isUnique isNullable }
            }
          }
        }
        """,
        {"id": object_id},
    )
    return {e["node"]["name"]: e["node"] for e in data["data"]["fields"]["edges"]}


def ensure_field(
    object_id: str,
    fields: dict[str, dict],
    *,
    name: str,
    label: str,
    description: str,
    field_type: str,
    options: list[dict] | None = None,
) -> dict:
    if name in fields:
        print(f"  OK field {name} ({fields[name]['type']}) id={fields[name]['id']}")
        return fields[name]
    field_body: dict = {
        "type": field_type,
        "name": name,
        "label": label,
        "description": description,
        "objectMetadataId": object_id,
        "isNullable": True,
        "isUnique": False,
        "isLabelSyncedWithName": False,
    }
    if options:
        field_body["options"] = options
    data = gql(
        """
        mutation CreateField($input: CreateOneFieldMetadataInput!) {
          createOneField(input: $input) { id name type }
        }
        """,
        {"input": {"field": field_body}},
    )
    created = data["data"]["createOneField"]
    print(f"  CREATED {name} type={created['type']} id={created['id']}")
    return created


def ensure_select_options(field: dict, wanted: list[tuple[str, str, str]]) -> None:
    if not field.get("id"):
        return
    # refresh
    # caller should re-fetch; use update merge
    opts = list(field.get("options") or [])
    existing = {o.get("value") for o in opts}
    changed = False
    position = max((o.get("position") or 0) for o in opts) + 1 if opts else 0
    for value, label, color in wanted:
        if value in existing:
            continue
        opts.append(
            {
                "id": str(uuid.uuid4()),
                "value": value,
                "label": label,
                "color": color,
                "position": position,
            }
        )
        position += 1
        changed = True
        print(f"  ADDED option {field.get('name')}.{value}")
    if not changed:
        print(f"  OK options for {field.get('name')}")
        return
    gql(
        """
        mutation UpdateField($input: UpdateOneFieldMetadataInput!) {
          updateOneField(input: $input) { id name options }
        }
        """,
        {"input": {"id": field["id"], "update": {"options": opts}}},
    )


def opt(value: str, label: str, color: str, position: int) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "value": value,
        "label": label,
        "color": color,
        "position": position,
    }


def main() -> int:
    load_dotenv_local()
    ids = object_ids()
    if "opportunity" not in ids:
        raise SystemExit("Brak obiektu opportunity")

    oid = ids["opportunity"]
    print("=== Lead Dispatcher fields (Opportunity) ===")
    fields = fields_for(oid)

    intent_opts = [
        opt("HOT_FIT", "HOT", "red", 0),
        opt("STANDARD", "STANDARD", "blue", 1),
        opt("LOW_INTENT", "LOW", "gray", 2),
    ]
    ensure_field(
        oid,
        fields,
        name="bizLeadIntentClass",
        label="Klasa leada (dyspozytor)",
        description="HOT/STANDARD/LOW — tylko zegary failover/eskalacji. CRM-only.",
        field_type="SELECT",
        options=intent_opts,
    )
    fields = fields_for(oid)
    ensure_select_options(
        fields["bizLeadIntentClass"],
        [
            ("HOT_FIT", "HOT", "red"),
            ("STANDARD", "STANDARD", "blue"),
            ("LOW_INTENT", "LOW", "gray"),
        ],
    )

    channel_opts = [
        opt("EMAIL", "Email", "blue", 0),
        opt("MANUAL", "Manual / telefon", "green", 1),
    ]
    fields = fields_for(oid)
    ensure_field(
        oid,
        fields,
        name="bizFirstAttemptChannel",
        label="Kanał first attempt",
        description="EMAIL = outbound mail; MANUAL = stage poza NEW (zwykle telefon).",
        field_type="SELECT",
        options=channel_opts,
    )
    fields = fields_for(oid)
    ensure_select_options(
        fields["bizFirstAttemptChannel"],
        [("EMAIL", "Email", "blue"), ("MANUAL", "Manual / telefon", "green")],
    )

    for name, label, desc, ftype in [
        (
            "bizAssignedAt",
            "Przydzielono (dyspozytor)",
            "Start zegara failover.",
            "DATE_TIME",
        ),
        (
            "bizAckAt",
            "Biorę (ack)",
            "Klik „Biorę” — wyłącza failover; eskalacja dalej liczy.",
            "DATE_TIME",
        ),
        (
            "bizFirstAttemptAt",
            "First attempt",
            "Wyjście z pętli dyspozytora — metryka TIME TO LEAD.",
            "DATE_TIME",
        ),
        (
            "bizManagerAlertedAt",
            "Eskalacja managera",
            "Jednorazowy stempel maila do managera.",
            "DATE_TIME",
        ),
        (
            "bizFailoverCount",
            "Failover count",
            "Ile razy lead przeszedł do drugiej osoby.",
            "NUMBER",
        ),
        (
            "bizTimeOnPageMs",
            "Czas na stronie (ms)",
            "Surowy ctx_time_on_page_ms z formularza — próg HOT > 360000.",
            "NUMBER",
        ),
        (
            "bizRoutingRule",
            "Reguła routingu",
            "ID reguły np. RULE-CONTINUITY / RULE-META-INTERIM / RULE-POOL-DEFAULT.",
            "TEXT",
        ),
    ]:
        fields = fields_for(oid)
        ensure_field(
            oid,
            fields,
            name=name,
            label=label,
            description=desc,
            field_type=ftype,
        )

    print("=== DONE ===")
    print("Następnie: LEAD_DISPATCHER_ENABLED=true w workerze po smoke.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print("ERROR:", exc, file=sys.stderr)
        raise SystemExit(1) from exc
