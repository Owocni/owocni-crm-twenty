#!/usr/bin/env python3
"""Deploy Owocni Mail when `yarn twenty apply` fails on metadata drift.

Patches built manifest (strips auto-generated relation/morph fields), uploads
built files, then calls syncApplication via Twenty CLI OAuth token.
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any

APP_UID = "7e0eb364-5229-495c-a6a0-5f19d5a992f5"
APP_DIR = pathlib.Path(__file__).resolve().parents[2] / "apps" / "owocni-mail-twenty"
OUTPUT_DIR = APP_DIR / ".twenty" / "output"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
CONFIG_PATH = pathlib.Path.home() / ".twenty" / "config.json"

KEEP_FIELD_TYPES = {
    "TEXT",
    "RICH_TEXT",
    "SELECT",
    "BOOLEAN",
    "NUMBER",
    "DATE_TIME",
    "RAW_JSON",
    "ARRAY",
    "UUID",
}


def load_oauth() -> tuple[str, str]:
    cfg = json.loads(CONFIG_PATH.read_text())
    remote_name = cfg.get("defaultRemote")
    remote = cfg["remotes"][remote_name]
    token = remote.get("twentyCLIAccessToken") or remote.get("accessToken")
    if not token:
        raise SystemExit("No OAuth token in ~/.twenty/config.json — run `yarn twenty remote:add`")
    api_url = remote["apiUrl"].rstrip("/")
    return token, f"{api_url}/metadata"


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
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
    if data.get("errors"):
        raise RuntimeError(json.dumps(data["errors"], ensure_ascii=False)[:4000])
    return data


def patch_manifest(manifest: dict) -> dict:
    m = json.loads(json.dumps(manifest))

    for obj in m.get("objects", []):
        obj["fields"] = [
            f
            for f in obj.get("fields", [])
            if f.get("type") in KEEP_FIELD_TYPES
        ]

    m["fields"] = []
    m["pageLayoutTabs"] = []

    for layout in m.get("pageLayouts", []):
        for tab in layout.get("tabs", []):
            if tab.get("layoutMode") == "CANVAS" and any(
                w.get("gridPosition") for w in tab.get("widgets", [])
            ):
                tab["layoutMode"] = "GRID"

    return m


def file_checksum(path: pathlib.Path, algo: str) -> str:
    h = hashlib.new(algo)
    h.update(path.read_bytes())
    return h.hexdigest()


def collect_uploads(manifest: dict) -> list[tuple[str, str, pathlib.Path]]:
    uploads: list[tuple[str, str, pathlib.Path]] = []

    for fc in manifest.get("frontComponents", []):
        rel = fc.get("builtComponentPath")
        if rel:
            uploads.append(("BuiltFrontComponent", rel, OUTPUT_DIR / rel))

    for lf in manifest.get("logicFunctions", []):
        rel = lf.get("builtHandlerPath")
        if rel:
            uploads.append(("BuiltLogicFunction", rel, OUTPUT_DIR / rel))

    for asset in manifest.get("publicAssets", []):
        rel = asset.get("filePath")
        if rel:
            uploads.append(("PublicAsset", rel, OUTPUT_DIR / rel))

    for name, folder in (("package.json", "Dependencies"), ("yarn.lock", "Dependencies")):
        p = OUTPUT_DIR / name
        if p.exists():
            uploads.append((folder, name, p))

    return uploads


def upload_file(
    metadata_url: str, token: str, folder: str, rel_path: str, full_path: pathlib.Path
) -> None:
    content = full_path.read_bytes()
    mime = mimetypes.guess_type(full_path.name)[0] or "application/octet-stream"
    operations = json.dumps(
        {
            "query": """
              mutation UploadApplicationFile(
                $file: Upload!
                $applicationUniversalIdentifier: String!
                $fileFolder: FileFolder!
                $filePath: String!
              ) {
                uploadApplicationFile(
                  file: $file
                  applicationUniversalIdentifier: $applicationUniversalIdentifier
                  fileFolder: $fileFolder
                  filePath: $filePath
                ) { path }
              }
            """,
            "variables": {
                "file": None,
                "applicationUniversalIdentifier": APP_UID,
                "fileFolder": folder,
                "filePath": rel_path,
            },
        }
    )
    body = (
        f"--boundary\r\n"
        f'Content-Disposition: form-data; name="operations"\r\n\r\n'
        f"{operations}\r\n"
        f"--boundary\r\n"
        f'Content-Disposition: form-data; name="map"\r\n\r\n'
        f'{{"0":["variables.file"]}}\r\n'
        f"--boundary\r\n"
        f'Content-Disposition: form-data; name="0"; filename="{full_path.name}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + content + b"\r\n--boundary--\r\n"

    last_error: Exception | None = None
    for attempt in range(1, 5):
        req = urllib.request.Request(
            metadata_url,
            data=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "multipart/form-data; boundary=boundary",
                "User-Agent": "Mozilla/5.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read())
            if data.get("errors"):
                raise RuntimeError(f"upload {rel_path}: {data['errors']}")
            return
        except (urllib.error.HTTPError, TimeoutError, OSError) as exc:
            last_error = exc
            code = getattr(exc, "code", None)
            retryable = code in {502, 503, 504} or isinstance(exc, (TimeoutError, OSError))
            if not retryable or attempt == 4:
                raise
            print(f"  retry {rel_path} ({code or type(exc).__name__}) attempt {attempt}")
            time.sleep(3 * attempt)
    if last_error:
        raise last_error


def update_checksums(manifest: dict) -> dict:
    m = patch_manifest(manifest)
    for fc in m.get("frontComponents", []):
        rel = fc.get("builtComponentPath")
        if not rel:
            continue
        p = OUTPUT_DIR / rel
        if p.exists():
            fc["builtComponentChecksum"] = file_checksum(p, "sha256")

    for lf in m.get("logicFunctions", []):
        rel = lf.get("builtHandlerPath")
        if not rel:
            continue
        p = OUTPUT_DIR / rel
        if p.exists():
            lf["builtHandlerChecksum"] = file_checksum(p, "md5")

    pkg = OUTPUT_DIR / "package.json"
    if pkg.exists():
        m["application"]["packageJsonChecksum"] = file_checksum(pkg, "md5")

    lock = OUTPUT_DIR / "yarn.lock"
    if lock.exists():
        m["application"]["yarnLockChecksum"] = file_checksum(lock, "md5")

    return m


def main() -> None:
    if not MANIFEST_PATH.exists():
        raise SystemExit(f"Missing {MANIFEST_PATH} — run `yarn twenty dev:build` first")

    raw = json.loads(MANIFEST_PATH.read_text())
    version = raw.get("application", {}).get("version", "?")
    print(f"Owocni Mail deploy (patched) v{version}")

    token, metadata_url = load_oauth()
    manifest = update_checksums(raw)

    uploads = collect_uploads(manifest)
    print(f"Uploading {len(uploads)} files...")
    for folder, rel, path in uploads:
        if not path.exists():
            print(f"  skip missing {rel}")
            continue
        upload_file(metadata_url, token, folder, rel, path)
        print(f"  ok {rel}")

    print("Syncing manifest (dry-run)...")
    dry = gql(
        metadata_url,
        token,
        """
          mutation SyncApplication($manifest: JSON!, $dryRun: Boolean) {
            syncApplication(manifest: $manifest, dryRun: $dryRun) {
              applicationUniversalIdentifier
              actions
            }
          }
        """,
        {"manifest": manifest, "dryRun": True},
    )
    actions = dry["data"]["syncApplication"].get("actions") or []
    if isinstance(actions, dict):
        errors = actions.get("errors") or actions.get("validationErrors") or []
    else:
        errors = [
            a
            for a in actions
            if isinstance(a, dict) and a.get("type") == "error"
        ]
    if errors:
        print(json.dumps(errors[:10], indent=2, ensure_ascii=False))
        raise SystemExit(f"Dry-run still has {len(errors)} validation errors")

    print(f"Dry-run OK ({len(actions)} actions)")

    print("Syncing manifest (apply)...")
    applied = gql(
        metadata_url,
        token,
        """
          mutation SyncApplication($manifest: JSON!) {
            syncApplication(manifest: $manifest) {
              applicationUniversalIdentifier
              actions
            }
          }
        """,
        {"manifest": manifest},
    )
    app = gql(
        metadata_url,
        token,
        f'query {{ findOneApplication(universalIdentifier: "{APP_UID}") {{ version packageJsonChecksum }} }}',
    )
    info = app["data"]["findOneApplication"]
    print(f"Done. Server version={info['version']} checksum={info['packageJsonChecksum']}")
    print(json.dumps(applied["data"]["syncApplication"].get("actions", {}), indent=2)[:1500])
    # App sync drops FIELDS widget viewId; re-pin full page + field groups + action order.
    pin_script = pathlib.Path(__file__).with_name("deploy_opportunity_record_page.py")
    if os.environ.get("SKIP_RECORD_PAGE_PIN") == "1":
        print("Skipping opportunity record page pin (SKIP_RECORD_PAGE_PIN=1)")
    else:
        print("Re-applying opportunity record page (full page + fields + actions)…")
        subprocess.check_call([sys.executable, str(pin_script)])


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
