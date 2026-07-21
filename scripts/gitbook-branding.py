#!/usr/bin/env python3
"""Rename the homepage and apply ARC branding to the GitBook site."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.gitbook.com/v1"
ORG = "WZXFVSbXcTHxw7L2adfr"
SITE = "site_DwANN"
SPACE = "kfR4fkvJNy9JZ6sxujxc"
BRAND = "#E75328"
GITHUB = "https://github.com/a-lavreniuk/Artist-Reference-Collection"
RELEASES = GITHUB + "/releases"

TOKEN = os.environ.get("GITBOOK_TOKEN", "").strip()
if not TOKEN:
    sys.exit("GITBOOK_TOKEN is not set")


def api(method, path, body=None):
    url = API + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} {method} {path}\n{e.read().decode('utf-8')}")
        return None


def rename_homepage():
    pages = api("GET", f"/spaces/{SPACE}/content/pages")["pages"]
    root_id = pages[0]["id"]
    for path in (
        f"/spaces/{SPACE}/content/page/{root_id}",
    ):
        res = api("PATCH", path, {"title": "Добро пожаловать"})
        if res is not None:
            print("Homepage renamed ->", res.get("title"))
            return
    print("Could not rename homepage (title stays 'Page')")


def apply_branding():
    cur = api("GET", f"/orgs/{ORG}/sites/{SITE}/customization")
    if cur is None:
        print("Cannot read customization; skipping branding")
        return
    cur.pop("object", None)

    styling = cur.get("styling") or {}
    primary = styling.get("primaryColor") or {}
    if isinstance(primary, dict):
        primary["light"] = BRAND
        primary["dark"] = BRAND
    else:
        primary = {"light": BRAND, "dark": BRAND}
    styling["primaryColor"] = primary
    cur["styling"] = styling

    header = cur.get("header") or {}
    header["links"] = [
        {"title": "GitHub", "to": {"kind": "url", "url": GITHUB}, "links": []},
        {"title": "Скачать", "to": {"kind": "url", "url": RELEASES}, "links": []},
    ]
    cur["header"] = header

    res = api("PUT", f"/orgs/{ORG}/sites/{SITE}/customization", cur)
    if res is not None:
        print("Branding applied: primaryColor + header links")
    else:
        # Retry with only color if header schema rejected.
        cur["header"] = header.__class__(header)
        cur["header"].pop("links", None)
        res2 = api("PUT", f"/orgs/{ORG}/sites/{SITE}/customization", cur)
        print("Branding color-only applied" if res2 is not None else "Branding failed")


if __name__ == "__main__":
    rename_homepage()
    apply_branding()
