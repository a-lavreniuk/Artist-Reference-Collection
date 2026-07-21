#!/usr/bin/env python3
"""Push docs/gitbook content into the GitBook space via the REST API.

Reads the token from the GITBOOK_TOKEN environment variable (never from a file).
Idempotent-ish: inserts are matched by title within a parent, existing pages are
reused, so the script can be re-run to resume after a failure.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.gitbook.com/v1"
ORG = "WZXFVSbXcTHxw7L2adfr"
SITE = "site_DwANN"
SPACE = "kfR4fkvJNy9JZ6sxujxc"
ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "gitbook"

TOKEN = os.environ.get("GITBOOK_TOKEN", "").strip()
if not TOKEN:
    sys.exit("GITBOOK_TOKEN is not set")

# path (relative to docs/gitbook) -> Russian title
TITLES = {
    "README.md": "База знаний ARC",
    "about/README.md": "О проекте",
    "about/what-is-arc.md": "Что такое и зачем нужен ARC",
    "about/goals.md": "Идея и цели",
    "about/platform.md": "Платформа",
    "about/core-mechanics.md": "Основные механики",
    "about/glossary.md": "Глоссарий",
    "getting-started/README.md": "Первые шаги",
    "getting-started/window-overview.md": "Обзор окна ARC",
    "getting-started/topbar.md": "Топбар",
    "getting-started/section-tabs.md": "Вкладки разделов",
    "getting-started/navbar-search.md": "Поиск в навбаре",
    "getting-started/menu.md": "Меню",
    "getting-started/onboarding-first-import.md": "Онбординг и первый импорт",
    "user-guide/README.md": "Руководство по приложению",
    "user-guide/library/README.md": "Библиотека",
    "user-guide/library/overview.md": "Обзор библиотеки",
    "user-guide/library/import.md": "Импорт: «Добавить» и перетаскивание",
    "user-guide/library/empty-state.md": "Пустая библиотека и «ничего не найдено»",
    "user-guide/library/grid-collections-strip.md": "Сетка и полоса коллекций",
    "user-guide/library/areas-library-unlabeled-trash.md": "Области: вся библиотека, без меток, корзина",
    "user-guide/library/sort-grid-size.md": "Сортировка и размер сетки",
    "user-guide/organization/README.md": "Организация",
    "user-guide/organization/overview.md": "Обзор организации",
    "user-guide/organization/collections.md": "Коллекции",
    "user-guide/organization/stats-history.md": "Статистика и история",
    "user-guide/organization/tags-categories.md": "Категории и метки",
    "user-guide/organization/moodboard.md": "Мудборд",
    "user-guide/search/README.md": "Поиск",
    "user-guide/search/navbar-overview.md": "Обзор поиска в навбаре",
    "user-guide/search/ai-semantic.md": "Режим «AI Семантика»",
    "user-guide/search/similar-images.md": "Режим «Похожие изображения»",
    "user-guide/search/tags-mode.md": "Режим «Метки»",
    "user-guide/search/color-mode.md": "Режим «По цвету»",
    "user-guide/search/card-id.md": "Поиск по ID карточки",
    "user-guide/filters/README.md": "Фильтры",
    "user-guide/filters/overview.md": "Обзор фильтров",
    "user-guide/filters/file-type.md": "Тип файла",
    "user-guide/filters/link.md": "Ссылка",
    "user-guide/filters/file-size.md": "Вес файла",
    "user-guide/filters/duration.md": "Длительность",
    "user-guide/filters/presets.md": "Пресеты",
    "user-guide/filters/aspect-ratio.md": "Соотношение сторон",
    "user-guide/filters/description.md": "Описание",
    "user-guide/filters/date-added.md": "Дата добавления",
    "user-guide/filters/resolution.md": "Разрешение",
    "user-guide/filters/customize-list.md": "Настроить список",
    "user-guide/cards/README.md": "Карточки",
    "user-guide/cards/overview.md": "Обзор карточки",
    "user-guide/cards/context-menu.md": "Контекстное меню (ПКМ)",
    "user-guide/cards/trash-restore.md": "Корзина: восстановление и очистка",
    "user-guide/cards/detail-overlay.md": "Деталка или оверлей просмотра",
    "user-guide/cards/similar-from-card.md": "Похожие из карточки",
    "user-guide/cards/source-files.md": "Исходные файлы",
    "user-guide/settings/README.md": "Настройки",
    "user-guide/settings/overview.md": "Обзор настроек",
    "user-guide/settings/general.md": "Общие",
    "user-guide/settings/screenshots.md": "Скриншоты",
    "user-guide/settings/notifications.md": "Уведомления",
    "user-guide/settings/hotkeys.md": "Горячие клавиши",
    "user-guide/settings/library-folder.md": "Папка библиотеки",
    "user-guide/settings/backup.md": "Резервная копия",
    "user-guide/settings/integrity-check.md": "Проверка целостности",
    "user-guide/settings/auto-import.md": "Автоимпорт",
    "user-guide/settings/ai-search.md": "AI Поиск",
    "user-guide/settings/updates-panel.md": "Панель обновлений приложения",
    "user-guide/settings/browser-extension.md": "Расширение браузера",
    "user-guide/report-problem.md": "Сообщить о проблеме",
    "user-guide/duplicate-search.md": "Поиск дублей",
    "testers/README.md": "Для тестеров",
    "testers/install-update.md": "Установка и обновление",
    "testers/data-storage.md": "Где хранятся данные",
    "testers/ai-search.md": "AI-поиск для тестеров",
    "testers/devtools-logs.md": "DevTools и логи",
    "testers/known-issues.md": "Известные проблемы",
    "testers/bug-reporting.md": "Сообщение о багах",
    "testers/test-checklists.md": "Чек-листы тестирования",
    "testers/scenario-runs.md": "Сценарные прогоны",
    "testers/feature-matrix/README.md": "Матрица функционала",
    "testers/feature-matrix/window-navigation.md": "Матрица: окно и навигация",
    "testers/feature-matrix/library-cards.md": "Матрица: библиотека и карточки",
    "testers/feature-matrix/organization.md": "Матрица: организация",
    "testers/feature-matrix/search-filters-sort.md": "Матрица: поиск, фильтры, сортировка",
    "testers/feature-matrix/settings.md": "Матрица: настройки",
    "testers/feature-matrix/import-integrations.md": "Матрица: импорт и интеграции",
    "testers/feature-matrix/system-service.md": "Матрица: система и сервис",
    "design-system/README.md": "Дизайн система",
    "design-system/typography.md": "Типографика",
    "design-system/spacing-system.md": "Система высот",
    "design-system/tokens.md": "Токены",
    "design-system/palette.md": "Палитра",
    "useful-links.md": "Полезные ссылки",
}

# Hierarchy: (path, [children]) — depth-first, matching the Wiki sidebar.
TREE = [
    ("about/README.md", [
        ("about/what-is-arc.md", []),
        ("about/goals.md", []),
        ("about/platform.md", []),
        ("about/core-mechanics.md", []),
        ("about/glossary.md", []),
    ]),
    ("getting-started/README.md", [
        ("getting-started/window-overview.md", []),
        ("getting-started/topbar.md", []),
        ("getting-started/section-tabs.md", []),
        ("getting-started/navbar-search.md", []),
        ("getting-started/menu.md", []),
        ("getting-started/onboarding-first-import.md", []),
    ]),
    ("user-guide/README.md", [
        ("user-guide/library/README.md", [
            ("user-guide/library/overview.md", []),
            ("user-guide/library/import.md", []),
            ("user-guide/library/empty-state.md", []),
            ("user-guide/library/grid-collections-strip.md", []),
            ("user-guide/library/areas-library-unlabeled-trash.md", []),
            ("user-guide/library/sort-grid-size.md", []),
        ]),
        ("user-guide/organization/README.md", [
            ("user-guide/organization/overview.md", []),
            ("user-guide/organization/collections.md", []),
            ("user-guide/organization/stats-history.md", []),
            ("user-guide/organization/tags-categories.md", []),
            ("user-guide/organization/moodboard.md", []),
        ]),
        ("user-guide/search/README.md", [
            ("user-guide/search/navbar-overview.md", []),
            ("user-guide/search/ai-semantic.md", []),
            ("user-guide/search/similar-images.md", []),
            ("user-guide/search/tags-mode.md", []),
            ("user-guide/search/color-mode.md", []),
            ("user-guide/search/card-id.md", []),
        ]),
        ("user-guide/filters/README.md", [
            ("user-guide/filters/overview.md", []),
            ("user-guide/filters/file-type.md", []),
            ("user-guide/filters/link.md", []),
            ("user-guide/filters/file-size.md", []),
            ("user-guide/filters/duration.md", []),
            ("user-guide/filters/presets.md", []),
            ("user-guide/filters/aspect-ratio.md", []),
            ("user-guide/filters/description.md", []),
            ("user-guide/filters/date-added.md", []),
            ("user-guide/filters/resolution.md", []),
            ("user-guide/filters/customize-list.md", []),
        ]),
        ("user-guide/cards/README.md", [
            ("user-guide/cards/overview.md", []),
            ("user-guide/cards/context-menu.md", []),
            ("user-guide/cards/trash-restore.md", []),
            ("user-guide/cards/detail-overlay.md", []),
            ("user-guide/cards/similar-from-card.md", []),
            ("user-guide/cards/source-files.md", []),
        ]),
        ("user-guide/settings/README.md", [
            ("user-guide/settings/overview.md", []),
            ("user-guide/settings/general.md", []),
            ("user-guide/settings/screenshots.md", []),
            ("user-guide/settings/notifications.md", []),
            ("user-guide/settings/hotkeys.md", []),
            ("user-guide/settings/library-folder.md", []),
            ("user-guide/settings/backup.md", []),
            ("user-guide/settings/integrity-check.md", []),
            ("user-guide/settings/auto-import.md", []),
            ("user-guide/settings/ai-search.md", []),
            ("user-guide/settings/updates-panel.md", []),
            ("user-guide/settings/browser-extension.md", []),
        ]),
        ("user-guide/report-problem.md", []),
        ("user-guide/duplicate-search.md", []),
    ]),
    ("testers/README.md", [
        ("testers/install-update.md", []),
        ("testers/data-storage.md", []),
        ("testers/ai-search.md", []),
        ("testers/devtools-logs.md", []),
        ("testers/known-issues.md", []),
        ("testers/bug-reporting.md", []),
        ("testers/test-checklists.md", []),
        ("testers/scenario-runs.md", []),
        ("testers/feature-matrix/README.md", [
            ("testers/feature-matrix/window-navigation.md", []),
            ("testers/feature-matrix/library-cards.md", []),
            ("testers/feature-matrix/organization.md", []),
            ("testers/feature-matrix/search-filters-sort.md", []),
            ("testers/feature-matrix/settings.md", []),
            ("testers/feature-matrix/import-integrations.md", []),
            ("testers/feature-matrix/system-service.md", []),
        ]),
    ]),
    ("design-system/README.md", [
        ("design-system/typography.md", []),
        ("design-system/spacing-system.md", []),
        ("design-system/tokens.md", []),
        ("design-system/palette.md", []),
    ]),
    ("useful-links.md", []),
]


def api(method: str, path: str, body=None):
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
        detail = e.read().decode("utf-8")
        raise SystemExit(f"HTTP {e.code} {method} {path}\n{detail}")


def read_md(rel: str) -> str:
    return (DOCS / rel).read_text(encoding="utf-8")


def flatten_titles(pages, acc):
    for p in pages:
        acc[p["id"]] = p.get("title", "")
        if p.get("pages"):
            flatten_titles(p["pages"], acc)


def get_cr_pages(cr_id: str):
    """Return the CR page tree, trying known endpoints."""
    for path in (
        f"/spaces/{SPACE}/change-requests/{cr_id}/content/pages",
        f"/spaces/{SPACE}/change-requests/{cr_id}/pages",
    ):
        try:
            res = api("GET", path)
            if "pages" in res:
                return res["pages"]
        except SystemExit:
            continue
    # Fallback: resolve CR -> revision -> pages
    cr = api("GET", f"/spaces/{SPACE}/change-requests/{cr_id}")
    rev = cr.get("revision") or cr.get("headRevision")
    res = api("GET", f"/spaces/{SPACE}/revisions/{rev}/pages")
    return res.get("pages", [])


def index_by_parent_title(pages, parent_id, mapping):
    """mapping[(parent_id, title)] = page_id (recursive)."""
    for p in pages:
        mapping[(parent_id, p.get("title", ""))] = p["id"]
        if p.get("pages"):
            index_by_parent_title(p["pages"], p["id"], mapping)


def apply_changes(cr_id, changes):
    for i in range(0, len(changes), 45):
        batch = changes[i:i + 45]
        api("POST", f"/spaces/{SPACE}/change-requests/{cr_id}/content",
            {"changes": batch})
        print(f"  applied {len(batch)} changes")
        time.sleep(1)


def main():
    print("Renaming site and space...")
    api("PATCH", f"/orgs/{ORG}/sites/{SITE}", {"title": "ARC — База знаний"})
    api("PATCH", f"/spaces/{SPACE}", {"title": "База знаний"})

    live = api("GET", f"/spaces/{SPACE}/content/pages").get("pages", [])
    root_id = live[0]["id"] if live else None
    print("root page id:", root_id)

    cr_id = os.environ.get("GITBOOK_CR", "").strip()
    if not cr_id:
        cr = api("POST", f"/spaces/{SPACE}/change-requests",
                 {"subject": "Импорт базы знаний из GitHub Wiki"})
        cr_id = cr["id"]
    print("change request:", cr_id)

    # Pass A: homepage (update root) + top-level section pages.
    changes = []
    if root_id:
        changes.append({
            "operation": "update_page",
            "page": root_id,
            "document": {"markdown": read_md("README.md")},
        })
    for path, _children in TREE:
        changes.append({
            "operation": "insert_page",
            "title": TITLES[path],
            "document": {"markdown": read_md(path)},
        })
    print("Pass A: roots")
    apply_changes(cr_id, changes)

    pages = get_cr_pages(cr_id)
    idx = {}
    index_by_parent_title(pages, None, idx)

    # Pass B: children of each top-level section.
    changes = []
    parents_needed = []  # (path, title) that have their own children
    for path, children in TREE:
        parent_id = idx.get((None, TITLES[path]))
        for child_path, grandchildren in children:
            changes.append({
                "operation": "insert_page",
                "title": TITLES[child_path],
                "into": parent_id,
                "document": {"markdown": read_md(child_path)},
            })
            if grandchildren:
                parents_needed.append(child_path)
    print("Pass B: section children")
    apply_changes(cr_id, changes)

    pages = get_cr_pages(cr_id)
    idx = {}
    index_by_parent_title(pages, None, idx)

    # Pass C: grandchildren.
    changes = []
    for path, children in TREE:
        parent_id = idx.get((None, TITLES[path]))
        for child_path, grandchildren in children:
            if not grandchildren:
                continue
            child_id = idx.get((parent_id, TITLES[child_path]))
            for gpath, _ in grandchildren:
                changes.append({
                    "operation": "insert_page",
                    "title": TITLES[gpath],
                    "into": child_id,
                    "document": {"markdown": read_md(gpath)},
                })
    print("Pass C: grandchildren")
    apply_changes(cr_id, changes)

    print("Merging change request...")
    api("POST", f"/spaces/{SPACE}/change-requests/{cr_id}/merge", {})
    print("Done. CR merged:", cr_id)


if __name__ == "__main__":
    main()
