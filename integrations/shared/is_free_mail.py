#!/usr/bin/env python3
"""is_free_mail — Python mirror of integrations/shared/isFreeMail.js (SSOT v1)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
_BUNDLED = Path(__file__).resolve().parent / "data" / "free_mail_domains_v1.json"
_CANONICAL = REPO_ROOT / "owocni-crm" / "data" / "free_mail_domains_v1.json"
DEFAULT_JSON = _BUNDLED if _BUNDLED.exists() else _CANONICAL

_MULTI_TLD = {
    "co.uk",
    "com.au",
    "com.br",
    "com.pl",
    "net.pl",
    "com.mx",
    "com.tr",
    "com.ar",
    "co.jp",
    "co.nz",
    "co.il",
    "co.th",
    "co.kr",
    "co.id",
    "com.cn",
    "com.hk",
    "com.sg",
    "com.tw",
    "com.ph",
    "com.vn",
    "com.pe",
    "com.ve",
    "com.co",
    "com.my",
    "com.gr",
    "ne.jp",
    "on.net",
}


@lru_cache(maxsize=1)
def load_rules(json_path: str | None = None) -> dict:
    path = Path(json_path) if json_path else DEFAULT_JSON
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_email(raw: str) -> dict:
    s = re.sub(r"\s+", "", str(raw or "").strip().lower())
    at = s.rfind("@")
    if at < 1 or s.find("@") != at:
        return {"invalid": True, "email": None, "domain": None}
    local, domain = s[:at], s[at + 1 :]
    if not domain or domain.startswith(".") or domain.endswith("."):
        return {"invalid": True, "email": None, "domain": None}
    if domain == "googlemail.com":
        domain = "gmail.com"
    if domain == "gmail.com":
        local = local.split("+", 1)[0].replace(".", "")
    return {"invalid": False, "email": f"{local}@{domain}", "domain": domain}


def registrable_domain(domain: str | None) -> str | None:
    if not domain:
        return None
    parts = [p for p in domain.lower().strip().split(".") if p]
    if len(parts) < 2:
        return domain.lower().strip()
    last2 = ".".join(parts[-2:])
    if last2 in _MULTI_TLD and len(parts) >= 3:
        return ".".join(parts[-3:])
    return last2


def is_free_mail(
    domain_reg: str | None,
    *,
    json_path: str | None = None,
    patterns_enabled: bool | None = None,
) -> bool:
    if not domain_reg:
        return True
    rules = load_rules(json_path)
    d = domain_reg.lower().strip()
    never = set(rules.get("never_block") or [])
    if d in never:
        return False
    domains = rules.get("domains") or {}
    if d in domains:
        return True
    enable = (
        patterns_enabled
        if patterns_enabled is not None
        else (rules.get("patterns_optional") is False)
    )
    if enable:
        for p in rules.get("patterns") or []:
            if re.match(p["re"], d):
                return True
    return False


def company_domain_key(
    raw_email: str,
    *,
    json_path: str | None = None,
    patterns_enabled: bool | None = None,
) -> str | None:
    n = normalize_email(raw_email)
    if n["invalid"]:
        return None
    reg = registrable_domain(n["domain"])
    return None if is_free_mail(reg, json_path=json_path, patterns_enabled=patterns_enabled) else reg
