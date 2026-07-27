#!/usr/bin/env python3
"""Add Opportunity record tab „Rozmowy” — linked CallTranscript table (not Notes).

Idempotent: skips if a tab titled „Rozmowy” already exists on the default Opportunity layout.

Usage:
  export TWENTY_API_KEY=eyJ...
  python3 integrations/tools/deploy_opportunity_rozmowy_tab.py

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
USER_AGENT = "owocni-crm-deploy-rozmowy-tab/1.0"

OPPORTUNITY_OBJECT_ID = "7874c080-30c2-46c0-934c-905926d918e0"
CALL_TRANSCRIPTS_FIELD_ID = "047184ce-e269-4459-b268-119c1b5a9cd8"
CALL_TRANSCRIPT_INDEX_VIEW_ID = "060b449e-328d-4ae6-ac01-f5f0814929ec"
TAB_TITLE = "Rozmowy"
TAB_POSITION = 1.5
TAB_ICON = "IconPhone"


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


def find_opportunity_layout() -> dict:
    data = gql(
        """
        query GetOppLayout($objectMetadataId: String!, $pageLayoutType: PageLayoutType!) {
          getPageLayouts(objectMetadataId: $objectMetadataId, pageLayoutType: $pageLayoutType) {
            id
            name
            tabs {
              id
              title
              position
              icon
              widgets {
                id
                type
                title
                configuration {
                  __typename
                  ... on FieldConfiguration {
                    fieldMetadataId
                    fieldDisplayMode
                    viewId
                  }
                }
              }
            }
          }
        }
        """,
        {
            "objectMetadataId": OPPORTUNITY_OBJECT_ID,
            "pageLayoutType": "RECORD_PAGE",
        },
    )
    layouts = data["data"]["getPageLayouts"]
    if not layouts:
        raise RuntimeError("Brak layoutu RECORD_PAGE dla Opportunity")
    layout = layouts[0]
    for tab in layout.get("tabs") or []:
        if tab.get("title") == TAB_TITLE:
            return {"layout": layout, "existing_tab": tab}
    return {"layout": layout, "existing_tab": None}


def create_tab(page_layout_id: str) -> str:
    data = gql(
        """
        mutation CreateTab($input: CreatePageLayoutTabInput!) {
          createPageLayoutTab(input: $input) { id title position icon }
        }
        """,
        {
            "input": {
                "pageLayoutId": page_layout_id,
                "title": TAB_TITLE,
                "position": TAB_POSITION,
                "layoutMode": "CANVAS",
            }
        },
    )
    tab = data["data"]["createPageLayoutTab"]
    gql(
        """
        mutation UpdateTab($id: String!, $input: UpdatePageLayoutTabInput!) {
          updatePageLayoutTab(id: $id, input: $input) { id icon }
        }
        """,
        {"id": tab["id"], "input": {"icon": TAB_ICON}},
    )
    return tab["id"]


def create_widget(tab_id: str) -> str:
    data = gql(
        """
        mutation CreateWidget($input: CreatePageLayoutWidgetInput!) {
          createPageLayoutWidget(input: $input) { id title type }
        }
        """,
        {
            "input": {
                "pageLayoutTabId": tab_id,
                "title": TAB_TITLE,
                "type": "FIELD",
                "gridPosition": {
                    "row": 0,
                    "column": 0,
                    "rowSpan": 12,
                    "columnSpan": 12,
                },
                "configuration": {
                    "configurationType": "FIELD",
                    "fieldMetadataId": CALL_TRANSCRIPTS_FIELD_ID,
                    "fieldDisplayMode": "TABLE",
                    "viewId": CALL_TRANSCRIPT_INDEX_VIEW_ID,
                },
            }
        },
    )
    return data["data"]["createPageLayoutWidget"]["id"]


def main() -> None:
    load_dotenv_local()
    found = find_opportunity_layout()
    layout = found["layout"]
    existing = found["existing_tab"]
    if existing:
        has_field_widget = any(
            w.get("type") == "FIELD"
            and (w.get("configuration") or {}).get("fieldMetadataId")
            == CALL_TRANSCRIPTS_FIELD_ID
            for w in existing.get("widgets") or []
        )
        print(
            f"OK — zakładka „{TAB_TITLE}” już istnieje (tab={existing['id']}, widget={'tak' if has_field_widget else 'brak'})"
        )
        if not has_field_widget:
            widget_id = create_widget(existing["id"])
            print(f"Utworzono widget relacji: {widget_id}")
        return

    tab_id = create_tab(layout["id"])
    widget_id = create_widget(tab_id)
    print(f"Utworzono zakładkę „{TAB_TITLE}”: tab={tab_id}, widget={widget_id}")


if __name__ == "__main__":
    main()
