#!/usr/bin/env python3
"""Opportunity record page: side panel first, curated fields, stable action order.

Kanban click opens the side panel (Mail = last thread + Odpowiedz). Full window
is only via that button (navigate RecordShowPage). Do not force RECORD_PAGE.

This script pins Opportunity to SIDE_PANEL, attaches the workspace fields
view, groups the left-rail fields, and sets command-menu positions.

Idempotent. Uses ~/.twenty/config.json OAuth (same as deploy_owocni_mail_patched).

Usage:
  python3 integrations/tools/deploy_opportunity_record_page.py
"""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.request
from typing import Any

OPP_OBJECT_ID = "7874c080-30c2-46c0-934c-905926d918e0"
OWOCNI_LAYOUT_ID = "9eea4245-25c1-49c4-93ce-81441c461f15"
HOME_TAB_ID = "f1159d4a-06ed-4934-a362-7b3991017c96"
FIELDS_WIDGET_ID = "005f8007-6dbd-4b8f-a625-1352b241c892"
ACTIONS_WIDGET_ID = "5da88580-ad5f-4090-932b-fac1cf94773c"
FIELDS_VIEW_ID = "2cee1990-6596-47e3-9dbd-5738c89617a3"
LEJEK_VIEW_ID = "ba6ac841-c293-4744-855b-3a99ee135743"
ALL_OPPORTUNITIES_VIEW_ID = "54df245b-2500-4e6e-9b6e-2cdb9543042e"
# Canonical sidebar pin of the kanban. The old OBJECT „Wszystkie leady”
# (WSZYSTKIE_LEADY_NAV_ID) was rewritten to the same view and duplicated it.
LEJEK_NAV_ID = "180a0420-732f-4651-81e8-2d5559793731"
WSZYSTKIE_LEADY_NAV_ID = "6cab4f40-6afc-4511-803e-b91e5c9ac76f"

GROUP_LEAD_ID = "cde2ffdd-da06-4c8f-9250-6af0ed580ead"
GROUP_STATUS_ID = "bc4d04fd-4e86-4274-8732-3d9b4a1f0b22"
GROUP_MORE_ID = "c13d8d3b-2a5d-4a30-bc40-0940e685b3d7"

# Left rail — salesperson essentials, then status, then the rest (hidden).
LEAD_FIELDS = [
    "stage",
    "isFollowUp",
    "bizLastContactLabel",
    "lastContactAt",
    "bizProduct",
    "bizProjectType",
    "bizIntent",
    "bizValueDisplay",
    "amount",
    "pointOfContact",
    "bizCardEmail",
    "bizCardPhone",
    "company",
    "owner",
    "closeDate",
    "engagement",
]
STATUS_FIELDS = [
    "campaignRejected",
    "rejectionReason",
    "lossCategory",
    "lossDescription",
    "bizSqlConfirmed",
    "qualifiedAt",
    "snoozeUntil",
    "bizSource",
]
MORE_VISIBLE_FIELDS = [
    "bizAdditionalEmails",
    "bizAdditionalPhones",
    "bizContactRole",
    "bizMailingOptIn",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy",
]
ALWAYS_HIDDEN = {
    "id",
    "position",
    "searchVector",
    "deletedAt",
    "attachments",
    "noteTargets",
    "taskTargets",
    "timelineActivities",
    "messageThreadTargets",
    "calendarEventTargets",
    "callTranscripts",
    "faktury",
}

OWOCNI_MAIL_APPLICATION_ID = "50ae173b-ddda-496f-83e1-1fc3692ce454"

# Opportunity action bar (floats so they sit before native Twenty icons at 1+).
# Native SQL/reject stay unpinned — they cannot hide after the field is set.
ACTION_ORDER = [
    ("9244c456-43c6-4ff4-9e05-69b5a4582074", 0.01, True, "Odpowiedz"),
    ("3ecc17a4-ea44-4d88-a29a-2e7ad9d73f5d", 0.03, True, "Opportunity · Wystaw dokument"),
    ("a17d3a9c-43e7-441c-9ee3-0393ff4cb5ea", 0.04, True, "Global · Wystaw fakturę"),
    ("4764d3cb-022e-483f-8d0c-5e85c17bc684", 0.06, True, "Scal z leadem"),
]
APP_ACTION_LABELS = [
    ("Przyjmij jako SQL", 0.02),
    ("Odrzuć leada", 0.05),
]
# Same FC as the opportunity-scoped Odpowiedz — would duplicate on the lead card.
# Native SQL / Odrzuć — always-visible workflow buttons, replaced by app items.
UNPIN_COMMAND_IDS = [
    "eb0435cc-af83-48b6-bd81-75a1606d16c1",  # Odpowiedz, no object scope
    "4793020a-3da3-44d8-b2f1-4f0e559a087d",  # native Przyjmij jako SQL
    "6612f8e6-0a1e-4797-b8be-13a03361a86b",  # native Odrzuć leada
]

CONFIG_PATH = pathlib.Path.home() / ".twenty" / "config.json"
USER_AGENT = "owocni-crm-deploy-opportunity-record-page/1.0"


def load_oauth() -> tuple[str, str]:
    cfg = json.loads(CONFIG_PATH.read_text())
    remote = cfg["remotes"][cfg["defaultRemote"]]
    token = remote.get("twentyCLIAccessToken") or remote.get("accessToken")
    if not token:
        raise SystemExit("No OAuth token in ~/.twenty/config.json")
    return token, remote["apiUrl"].rstrip("/") + "/metadata"


def gql(url: str, token: str, query: str, variables: dict | None = None) -> dict:
    body: dict[str, Any] = {"query": query}
    if variables is not None:
        body["variables"] = variables
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read())
    if data.get("errors"):
        raise RuntimeError(json.dumps(data["errors"], ensure_ascii=False)[:4000])
    return data


def all_opportunity_fields(url: str, token: str) -> dict[str, dict]:
    fields: list[dict] = []
    after = None
    while True:
        paging = {"first": 200}
        if after:
            paging["after"] = after
        data = gql(
            url,
            token,
            """
            query($paging: CursorPaging!, $filter: FieldFilter!) {
              fields(paging: $paging, filter: $filter) {
                edges { cursor node { id name label type isSystem } }
                pageInfo { hasNextPage endCursor }
              }
            }
            """,
            {
                "paging": paging,
                "filter": {"objectMetadataId": {"eq": OPP_OBJECT_ID}},
            },
        )
        conn = data["data"]["fields"]
        fields.extend(e["node"] for e in conn["edges"])
        if not conn["pageInfo"]["hasNextPage"]:
            break
        after = conn["pageInfo"]["endCursor"]
    return {f["name"]: f for f in fields}


def pin_side_panel(url: str, token: str) -> None:
    gql(
        url,
        token,
        """
        mutation($input: UpdateOneObjectInput!) {
          updateOneObject(input: $input) { id nameSingular openRecordIn }
        }
        """,
        {
            "input": {
                "id": OPP_OBJECT_ID,
                "update": {"openRecordIn": "SIDE_PANEL"},
            }
        },
    )
    print("object.openRecordIn = SIDE_PANEL")

    views = gql(
        url,
        token,
        """
        query($objectMetadataId: String!) {
          getViews(objectMetadataId: $objectMetadataId) { id name type }
        }
        """,
        {"objectMetadataId": OPP_OBJECT_ID},
    )["data"]["getViews"]
    for view in views:
        if view["type"] == "FIELDS_WIDGET":
            continue
        gql(
            url,
            token,
            """
            mutation($id: String!, $input: UpdateViewInput!) {
              updateView(id: $id, input: $input) { id name }
            }
            """,
            {"id": view["id"], "input": {"openRecordIn": "SIDE_PANEL"}},
        )
        print(f"  view {view['name']!r} ({view['type']}) → SIDE_PANEL")


def pin_lejek_as_landing(url: str, token: str) -> None:
    """One sidebar pin for Lejek Owocni. All Opportunities stays last in the picker.

    Do not convert other Opportunity nav items into a second Lejek pin — that
    produced two identical „Lejek Owocni” entries in the workspace bar.
    """
    gql(
        url,
        token,
        """
        mutation($id: String!, $input: UpdateViewInput!) {
          updateView(id: $id, input: $input) { id name position }
        }
        """,
        {"id": ALL_OPPORTUNITIES_VIEW_ID, "input": {"position": 99}},
    )
    print("  All Opportunities position=99")

    listed = gql(
        url,
        token,
        """
        query {
          navigationMenuItems {
            id name type viewId position folderId
          }
        }
        """,
    )
    items = listed.get("data", {}).get("navigationMenuItems") or []
    lejek_pins = [
        item
        for item in items
        if item.get("type") == "VIEW"
        and item.get("viewId") == LEJEK_VIEW_ID
        and not item.get("folderId")
    ]
    if len(lejek_pins) <= 1:
        name = (lejek_pins[0].get("name") if lejek_pins else None) or "Lejek Owocni"
        print(f"  sidebar {name!r}: {len(lejek_pins)} pin")
        return

    keep_id = (
        LEJEK_NAV_ID
        if any(item.get("id") == LEJEK_NAV_ID for item in lejek_pins)
        else sorted(lejek_pins, key=lambda item: float(item.get("position") or 0))[0]["id"]
    )
    for item in lejek_pins:
        if item.get("id") == keep_id:
            continue
        gql(
            url,
            token,
            """
            mutation($id: UUID!) {
              deleteNavigationMenuItem(id: $id) { id }
            }
            """,
            {"id": item["id"]},
        )
        print(
            f"  removed duplicate Lejek Owocni nav {item.get('id')} "
            f"(kept {keep_id})"
        )


def rename_groups(url: str, token: str) -> None:
    for group_id, name, position in (
        (GROUP_LEAD_ID, "Lead", 0),
        (GROUP_STATUS_ID, "Status", 1),
        (GROUP_MORE_ID, "Więcej", 2),
    ):
        gql(
            url,
            token,
            """
            mutation($input: UpdateViewFieldGroupInput!) {
              updateViewFieldGroup(input: $input) { id name position }
            }
            """,
            {
                "input": {
                    "id": group_id,
                    "update": {"name": name, "position": position, "isVisible": True},
                }
            },
        )
        print(f"  group {name!r}")


def upsert_field_groups(url: str, token: str, by_name: dict[str, dict]) -> None:
    """Edit the workspace FIELDS_WIDGET view. Widget viewId is set by app deploy."""
    rename_groups(url, token)
    existing = gql(
        url,
        token,
        'query { getViewFields(viewId: "%s") { id fieldMetadataId } }' % FIELDS_VIEW_ID,
    )["data"]["getViewFields"]
    view_field_by_meta = {row["fieldMetadataId"]: row["id"] for row in existing}
    placed: set[str] = set()

    def assign(names: list[str], group_id: str, visible: bool, start: int = 0) -> int:
        count = 0
        for i, name in enumerate(names):
            meta = by_name.get(name)
            if not meta:
                print(f"  skip unknown field {name}")
                continue
            placed.add(name)
            pos = float(start + i)
            vf = view_field_by_meta.get(meta["id"])
            if vf:
                gql(
                    url,
                    token,
                    """
                    mutation($input: UpdateViewFieldInput!) {
                      updateViewField(input: $input) { id }
                    }
                    """,
                    {
                        "input": {
                            "id": vf,
                            "update": {
                                "isVisible": visible,
                                "position": pos,
                                "viewFieldGroupId": group_id,
                            },
                        }
                    },
                )
            else:
                created = gql(
                    url,
                    token,
                    """
                    mutation($input: CreateViewFieldInput!) {
                      createViewField(input: $input) { id }
                    }
                    """,
                    {
                        "input": {
                            "fieldMetadataId": meta["id"],
                            "viewId": FIELDS_VIEW_ID,
                            "isVisible": visible,
                            "position": pos,
                            "viewFieldGroupId": group_id,
                            "size": 150,
                        }
                    },
                )
                view_field_by_meta[meta["id"]] = created["data"]["createViewField"]["id"]
            count += 1
        return count

    n_lead = assign(LEAD_FIELDS, GROUP_LEAD_ID, True)
    n_status = assign(STATUS_FIELDS, GROUP_STATUS_ID, True)
    n_more = assign(MORE_VISIBLE_FIELDS, GROUP_MORE_ID, True)
    hidden = [name for name in sorted(by_name) if name not in placed]
    n_hidden = assign(hidden, GROUP_MORE_ID, False, start=len(MORE_VISIBLE_FIELDS))
    print(
        f"fields view {FIELDS_VIEW_ID}: Lead={n_lead} Status={n_status} "
        f"Więcej visible={n_more} hidden={n_hidden}"
    )


def order_actions(url: str, token: str) -> None:
    for item_id, position, pinned, label in ACTION_ORDER:
        gql(
            url,
            token,
            """
            mutation($input: UpdateCommandMenuItemInput!) {
              updateCommandMenuItem(input: $input) { id label position isPinned }
            }
            """,
            {
                "input": {
                    "id": item_id,
                    "position": position,
                    "isPinned": pinned,
                }
            },
        )
        print(f"  action {label!r} position={position} pinned={pinned}")
    for item_id in UNPIN_COMMAND_IDS:
        gql(
            url,
            token,
            """
            mutation($input: UpdateCommandMenuItemInput!) {
              updateCommandMenuItem(input: $input) { id label isPinned }
            }
            """,
            {"input": {"id": item_id, "isPinned": False}},
        )
        print(f"  unpinned {item_id}")

    items = gql(
        url,
        token,
        """
        query {
          commandMenuItems {
            id
            label
            applicationId
            workflowVersionId
            isPinned
          }
        }
        """,
    )["data"]["commandMenuItems"]
    by_label = {
        item["label"]: item
        for item in items
        if item.get("applicationId") == OWOCNI_MAIL_APPLICATION_ID
        and not item.get("workflowVersionId")
    }
    for label, position in APP_ACTION_LABELS:
        item = by_label.get(label)
        if not item:
            print(f"  skip missing app action {label!r}")
            continue
        gql(
            url,
            token,
            """
            mutation($input: UpdateCommandMenuItemInput!) {
              updateCommandMenuItem(input: $input) { id label position isPinned }
            }
            """,
            {
                "input": {
                    "id": item["id"],
                    "position": position,
                    "isPinned": True,
                }
            },
        )
        print(f"  app action {label!r} {item['id']} position={position}")


def order_home_widgets(url: str, token: str) -> None:
    """Actions strip above Fields (VERTICAL_LIST index)."""
    for widget_id, index, label in (
        (ACTIONS_WIDGET_ID, 0, "actions"),
        (FIELDS_WIDGET_ID, 1, "fields"),
    ):
        gql(
            url,
            token,
            """
            mutation($id: String!, $input: UpdatePageLayoutWidgetInput!) {
              updatePageLayoutWidget(id: $id, input: $input) { id }
            }
            """,
            {
                "id": widget_id,
                "input": {
                    "position": {"layoutMode": "VERTICAL_LIST", "index": index},
                },
            },
        )
        print(f"  home widget {label} index={index}")


def main() -> None:
    token, url = load_oauth()
    by_name = all_opportunity_fields(url, token)
    print(f"opportunity fields: {len(by_name)}")
    pin_side_panel(url, token)
    pin_lejek_as_landing(url, token)
    upsert_field_groups(url, token, by_name)
    order_actions(url, token)
    order_home_widgets(url, token)
    print("OK — hard-refresh Twenty (Cmd+Shift+R), then click a kanban card.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
