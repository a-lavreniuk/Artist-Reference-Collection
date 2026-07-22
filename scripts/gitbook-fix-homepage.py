#!/usr/bin/env python3
"""Replace the default 'Page' root with a titled homepage."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.gitbook.com/v1"
SPACE = "kfR4fkvJNy9JZ6sxujxc"
ROOT = Path(__file__).resolve().parents[1]
README = (ROOT / "docs" / "gitbook" / "README.md").read_text(encoding="utf-8")

TOKEN = os.environ.get("GITBOOK_TOKEN", "").strip()
if not TOKEN:
    sys.exit("GITBOOK_TOKEN is not set")


def api(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} {method} {path}\n{e.read().decode('utf-8')}")


pages = api("GET", f"/spaces/{SPACE}/content/pages")["pages"]
old_root = None
for p in pages:
    if p.get("title") == "Page":
        old_root = p["id"]
if not old_root:
    sys.exit("Default 'Page' not found; nothing to fix")

cr = api("POST", f"/spaces/{SPACE}/change-requests",
         {"subject": "Домашняя страница базы знаний"})["id"]
api("POST", f"/spaces/{SPACE}/change-requests/{cr}/content", {"changes": [
    {"operation": "insert_page", "title": "Добро пожаловать", "at": 0,
     "document": {"markdown": README}},
    {"operation": "delete_page", "page": old_root},
]})
api("POST", f"/spaces/{SPACE}/change-requests/{cr}/merge", {})
print("Homepage replaced; CR merged:", cr)
