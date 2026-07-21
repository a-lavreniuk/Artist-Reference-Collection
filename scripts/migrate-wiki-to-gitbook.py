#!/usr/bin/env python3
"""One-off migration: GitHub Wiki -> docs/gitbook for GitBook Git Sync."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / ".tmp-wiki"
OUT = ROOT / "docs" / "gitbook"

# Wiki page title -> output path (relative to docs/gitbook)
PAGES: dict[str, str] = {
    "Home": "README.md",
    "О проекте": "about/README.md",
    "Что такое и зачем нужен ARC": "about/what-is-arc.md",
    "Идея и цели": "about/goals.md",
    "Платформа": "about/platform.md",
    "Основные механики": "about/core-mechanics.md",
    "Глоссарий": "about/glossary.md",
    "Первые шаги": "getting-started/README.md",
    "Обзор окна ARC": "getting-started/window-overview.md",
    "Топбар": "getting-started/topbar.md",
    "Вкладки разделов": "getting-started/section-tabs.md",
    "Поиск в навбаре": "getting-started/navbar-search.md",
    "Меню": "getting-started/menu.md",
    "Онбординг и первый импорт": "getting-started/onboarding-first-import.md",
    "Руководство по приложению": "user-guide/README.md",
    "Библиотека": "user-guide/library/README.md",
    "Обзор библиотеки": "user-guide/library/overview.md",
    "Импорт- «Добавить» и перетаскивание": "user-guide/library/import.md",
    "Пустая библиотека и «ничего не найдено»": "user-guide/library/empty-state.md",
    "Сетка и полоса коллекций": "user-guide/library/grid-collections-strip.md",
    "Области- вся библиотека - без меток - корзина": "user-guide/library/areas-library-unlabeled-trash.md",
    "Сортировка и размер сетки": "user-guide/library/sort-grid-size.md",
    "Организация": "user-guide/organization/README.md",
    "Обзор организации": "user-guide/organization/overview.md",
    "Коллекции": "user-guide/organization/collections.md",
    "Статистика и история": "user-guide/organization/stats-history.md",
    "Категории и метки": "user-guide/organization/tags-categories.md",
    "Мудборд": "user-guide/organization/moodboard.md",
    "Поиск": "user-guide/search/README.md",
    "Обзор поиска в навбаре": "user-guide/search/navbar-overview.md",
    "Режим «AI Семантика»": "user-guide/search/ai-semantic.md",
    "Режим «Похожие изображения»": "user-guide/search/similar-images.md",
    "Режим «Метки»": "user-guide/search/tags-mode.md",
    "Режим «По цвету»": "user-guide/search/color-mode.md",
    "Поиск по ID карточки": "user-guide/search/card-id.md",
    "Фильтры": "user-guide/filters/README.md",
    "Обзор фильтров": "user-guide/filters/overview.md",
    "Тип файла": "user-guide/filters/file-type.md",
    "Ссылка": "user-guide/filters/link.md",
    "Вес файла": "user-guide/filters/file-size.md",
    "Длительность": "user-guide/filters/duration.md",
    "Пресеты": "user-guide/filters/presets.md",
    "Соотношение сторон": "user-guide/filters/aspect-ratio.md",
    "Описание": "user-guide/filters/description.md",
    "Дата добавления": "user-guide/filters/date-added.md",
    "Разрешение": "user-guide/filters/resolution.md",
    "Настроить список": "user-guide/filters/customize-list.md",
    "Карточки": "user-guide/cards/README.md",
    "Обзор карточки": "user-guide/cards/overview.md",
    "Контекстное меню (ПКМ)": "user-guide/cards/context-menu.md",
    "Корзина- восстановление и очистка": "user-guide/cards/trash-restore.md",
    "Деталка или Оверлей просмотра": "user-guide/cards/detail-overlay.md",
    "Похожие из карточки": "user-guide/cards/similar-from-card.md",
    "Исходные файлы": "user-guide/cards/source-files.md",
    "Настройки": "user-guide/settings/README.md",
    "Обзор настроек": "user-guide/settings/overview.md",
    "Общие": "user-guide/settings/general.md",
    "Скриншоты": "user-guide/settings/screenshots.md",
    "Уведомления": "user-guide/settings/notifications.md",
    "Горячие клавиши": "user-guide/settings/hotkeys.md",
    "Папка библиотеки": "user-guide/settings/library-folder.md",
    "Резервная копия": "user-guide/settings/backup.md",
    "Проверка целостности": "user-guide/settings/integrity-check.md",
    "Автоимпорт": "user-guide/settings/auto-import.md",
    "AI Поиск": "user-guide/settings/ai-search.md",
    "Панель обновлений приложения": "user-guide/settings/updates-panel.md",
    "Расширение браузера": "user-guide/settings/browser-extension.md",
    "Сообщить о проблеме": "user-guide/report-problem.md",
    "Поиск дублей": "user-guide/duplicate-search.md",
    "Для тестеров": "testers/README.md",
    "Установка и обновление": "testers/install-update.md",
    "Где хранятся данные": "testers/data-storage.md",
    "AI-поиск для тестеров": "testers/ai-search.md",
    "DevTools и логи": "testers/devtools-logs.md",
    "Известные проблемы": "testers/known-issues.md",
    "Сообщение о багах": "testers/bug-reporting.md",
    "Чек-листы тестирования": "testers/test-checklists.md",
    "Сценарные прогоны": "testers/scenario-runs.md",
    "Матрица функционала": "testers/feature-matrix/README.md",
    "Матрица- Окно и навигация": "testers/feature-matrix/window-navigation.md",
    "Матрица- Библиотека и карточки": "testers/feature-matrix/library-cards.md",
    "Матрица- Организация": "testers/feature-matrix/organization.md",
    "Матрица- Поиск, фильтры, сортировка": "testers/feature-matrix/search-filters-sort.md",
    "Матрица- Настройки": "testers/feature-matrix/settings.md",
    "Матрица- Импорт и интеграции": "testers/feature-matrix/import-integrations.md",
    "Матрица- Система и сервис": "testers/feature-matrix/system-service.md",
    "Дизайн система": "design-system/README.md",
    "Типографика": "design-system/typography.md",
    "Система высот": "design-system/spacing-system.md",
    "Токены": "design-system/tokens.md",
    "Палитра": "design-system/palette.md",
    "Полезные ссылки": "useful-links.md",
}

WIKI_FILE: dict[str, str] = {
    title: ("Home.md" if title == "Home" else f"{title}.md") for title in PAGES
}

SUMMARY_LINES = """# Table of contents

* [Главная](README.md)

## О проекте

* [О проекте](about/README.md)
* [Что такое и зачем нужен ARC](about/what-is-arc.md)
* [Идея и цели](about/goals.md)
* [Платформа](about/platform.md)
* [Основные механики](about/core-mechanics.md)
* [Глоссарий](about/glossary.md)

## Первые шаги

* [Первые шаги](getting-started/README.md)
* [Обзор окна ARC](getting-started/window-overview.md)
* [Топбар](getting-started/topbar.md)
* [Вкладки разделов](getting-started/section-tabs.md)
* [Поиск в навбаре](getting-started/navbar-search.md)
* [Меню](getting-started/menu.md)
* [Онбординг и первый импорт](getting-started/onboarding-first-import.md)

## Руководство по приложению

* [Руководство по приложению](user-guide/README.md)
* [Библиотека](user-guide/library/README.md)
  * [Обзор библиотеки](user-guide/library/overview.md)
  * [Импорт: «Добавить» и перетаскивание](user-guide/library/import.md)
  * [Пустая библиотека и «ничего не найдено»](user-guide/library/empty-state.md)
  * [Сетка и полоса коллекций](user-guide/library/grid-collections-strip.md)
  * [Области: вся библиотека, без меток, корзина](user-guide/library/areas-library-unlabeled-trash.md)
  * [Сортировка и размер сетки](user-guide/library/sort-grid-size.md)
* [Организация](user-guide/organization/README.md)
  * [Обзор организации](user-guide/organization/overview.md)
  * [Коллекции](user-guide/organization/collections.md)
  * [Статистика и история](user-guide/organization/stats-history.md)
  * [Категории и метки](user-guide/organization/tags-categories.md)
  * [Мудборд](user-guide/organization/moodboard.md)
* [Поиск](user-guide/search/README.md)
  * [Обзор поиска в навбаре](user-guide/search/navbar-overview.md)
  * [Режим «AI Семантика»](user-guide/search/ai-semantic.md)
  * [Режим «Похожие изображения»](user-guide/search/similar-images.md)
  * [Режим «Метки»](user-guide/search/tags-mode.md)
  * [Режим «По цвету»](user-guide/search/color-mode.md)
  * [Поиск по ID карточки](user-guide/search/card-id.md)
* [Фильтры](user-guide/filters/README.md)
  * [Обзор фильтров](user-guide/filters/overview.md)
  * [Тип файла](user-guide/filters/file-type.md)
  * [Ссылка](user-guide/filters/link.md)
  * [Вес файла](user-guide/filters/file-size.md)
  * [Длительность](user-guide/filters/duration.md)
  * [Пресеты](user-guide/filters/presets.md)
  * [Соотношение сторон](user-guide/filters/aspect-ratio.md)
  * [Описание](user-guide/filters/description.md)
  * [Дата добавления](user-guide/filters/date-added.md)
  * [Разрешение](user-guide/filters/resolution.md)
  * [Настроить список](user-guide/filters/customize-list.md)
* [Карточки](user-guide/cards/README.md)
  * [Обзор карточки](user-guide/cards/overview.md)
  * [Контекстное меню (ПКМ)](user-guide/cards/context-menu.md)
  * [Корзина: восстановление и очистка](user-guide/cards/trash-restore.md)
  * [Деталка или оверлей просмотра](user-guide/cards/detail-overlay.md)
  * [Похожие из карточки](user-guide/cards/similar-from-card.md)
  * [Исходные файлы](user-guide/cards/source-files.md)
* [Настройки](user-guide/settings/README.md)
  * [Обзор настроек](user-guide/settings/overview.md)
  * [Общие](user-guide/settings/general.md)
  * [Скриншоты](user-guide/settings/screenshots.md)
  * [Уведомления](user-guide/settings/notifications.md)
  * [Горячие клавиши](user-guide/settings/hotkeys.md)
  * [Папка библиотеки](user-guide/settings/library-folder.md)
  * [Резервная копия](user-guide/settings/backup.md)
  * [Проверка целостности](user-guide/settings/integrity-check.md)
  * [Автоимпорт](user-guide/settings/auto-import.md)
  * [AI Поиск](user-guide/settings/ai-search.md)
  * [Панель обновлений приложения](user-guide/settings/updates-panel.md)
  * [Расширение браузера](user-guide/settings/browser-extension.md)
* [Сообщить о проблеме](user-guide/report-problem.md)
* [Поиск дублей](user-guide/duplicate-search.md)

## Для тестеров

* [Для тестеров](testers/README.md)
* [Установка и обновление](testers/install-update.md)
* [Где хранятся данные](testers/data-storage.md)
* [AI-поиск для тестеров](testers/ai-search.md)
* [DevTools и логи](testers/devtools-logs.md)
* [Известные проблемы](testers/known-issues.md)
* [Сообщение о багах](testers/bug-reporting.md)
* [Чек-листы тестирования](testers/test-checklists.md)
* [Сценарные прогоны](testers/scenario-runs.md)
* [Матрица функционала](testers/feature-matrix/README.md)
  * [Матрица: окно и навигация](testers/feature-matrix/window-navigation.md)
  * [Матрица: библиотека и карточки](testers/feature-matrix/library-cards.md)
  * [Матрица: организация](testers/feature-matrix/organization.md)
  * [Матрица: поиск, фильтры, сортировка](testers/feature-matrix/search-filters-sort.md)
  * [Матрица: настройки](testers/feature-matrix/settings.md)
  * [Матрица: импорт и интеграции](testers/feature-matrix/import-integrations.md)
  * [Матрица: система и сервис](testers/feature-matrix/system-service.md)

## Дизайн система

* [Дизайн система](design-system/README.md)
* [Типографика](design-system/typography.md)
* [Система высот](design-system/spacing-system.md)
* [Токены](design-system/tokens.md)
* [Палитра](design-system/palette.md)

## Прочее

* [Полезные ссылки](useful-links.md)
"""

HOME_CARDS = """
<table data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody>
<tr>
  <td><h3><i class="fa-circle-info" style="color:$primary;">:circle-info:</i></h3></td>
  <td><strong>О проекте</strong></td>
  <td>Зачем существует ARC, кому подходит и какие идеи лежат в основе продукта.</td>
  <td><a href="about/README.md">about</a></td>
</tr>
<tr>
  <td><h3><i class="fa-shoe-prints" style="color:$primary;">:shoe-prints:</i></h3></td>
  <td><strong>Первые шаги</strong></td>
  <td>Обзор окна, навбар, вкладки, меню и первый импорт.</td>
  <td><a href="getting-started/README.md">getting-started</a></td>
</tr>
<tr>
  <td><h3><i class="fa-book-open" style="color:$primary;">:book-open:</i></h3></td>
  <td><strong>Руководство по приложению</strong></td>
  <td>Библиотека, организация, поиск, фильтры, карточки и настройки.</td>
  <td><a href="user-guide/README.md">user-guide</a></td>
</tr>
<tr>
  <td><h3><i class="fa-flask" style="color:$primary;">:flask:</i></h3></td>
  <td><strong>Для тестеров</strong></td>
  <td>Чек-листы, матрица функционала и сценарные прогоны для сборки 0.1.4.</td>
  <td><a href="testers/README.md">testers</a></td>
</tr>
<tr>
  <td><h3><i class="fa-palette" style="color:$primary;">:palette:</i></h3></td>
  <td><strong>Дизайн система</strong></td>
  <td>Токены, типографика и правила дизайн-системы ARC-2.</td>
  <td><a href="design-system/README.md">design-system</a></td>
</tr>
</tbody></table>
"""

IMAGE_LINE = re.compile(r"^!\[[^\]]*\]\([^)]+\)\s*$")
IMG_TAG = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
WIKI_LINK = re.compile(r"\[\[([^\]]+)\]\]")
ESCAPED_STAR = re.compile(r"\\\*")


def dedupe_blocks(body: str) -> str:
    """Drop exact duplicate paragraphs (wiki export artifact: text repeated once
    plain and once with escaped markup)."""
    blocks = re.split(r"\n\s*\n", body)
    seen: set[str] = set()
    kept: list[str] = []
    for block in blocks:
        key = block.strip()
        if len(key) > 40 and key in seen:
            continue
        if key:
            seen.add(key)
        kept.append(block)
    return "\n\n".join(kept)


def wiki_path_for_title(title: str) -> Path:
    filename = WIKI_FILE[title]
    return WIKI / filename


def rel_link(from_path: Path, to_path: Path) -> str:
    rel = Path(os_path_relpath(from_path.parent, to_path))
    return rel.as_posix()


def os_path_relpath(start: Path, end: Path) -> str:
    import os

    return os.path.relpath(end, start)


BARE_WIKI_LINK = re.compile(r"^\[\[[^\]]+\]\]$")


def convert_content(text: str, source_out: Path) -> str:
    src_lines = text.splitlines()
    # Bare [[link]] lines duplicate the «Содержание» list below (AnyType export
    # artifact) — drop them only when the same link exists as a list item.
    list_links = {
        line.strip()[2:].strip()
        for line in src_lines
        if line.strip().startswith("- [[")
    }
    lines: list[str] = []
    for line in src_lines:
        stripped = line.strip()
        if IMAGE_LINE.match(stripped):
            continue
        if BARE_WIKI_LINK.match(stripped) and stripped in list_links:
            continue
        if IMG_TAG.search(line):
            line = IMG_TAG.sub("", line).rstrip()
            if not line:
                continue
        lines.append(line)

    body = "\n".join(lines)
    body = ESCAPED_STAR.sub("*", body)
    body = dedupe_blocks(body)

    def replace_link(match: re.Match[str]) -> str:
        title = match.group(1).strip()
        if title not in PAGES:
            return match.group(0)
        target = OUT / PAGES[title]
        href = rel_link(source_out, target)
        return f"[{title}]({href})"

    body = WIKI_LINK.sub(replace_link, body)
    return body.strip() + "\n"


def build_homepage(home_text: str) -> str:
    intro_lines: list[str] = []
    for line in home_text.splitlines():
        if line.strip().startswith("![") or line.strip().startswith("[[") or line.strip() == "## Разделы":
            break
        if line.strip() in ("Полезные ссылки", "Eagle"):
            break
        if line.strip():
            intro_lines.append(line)

    intro = "\n".join(intro_lines).strip()
    intro = ESCAPED_STAR.sub("*", intro)
    intro = WIKI_LINK.sub("", intro)

    useful = """## Полезные ссылки

- [Eagle](https://eagle.cool/)
- [Electron](http://electronproject.org/index-16.html)
- [Lummi](https://www.lummi.ai/)
- [Pinterest](https://ru.pinterest.com/alavreniuk_landy/_pins/)
- [Полезные ссылки](useful-links.md) — полный список из базы знаний
"""

    return f"{intro}\n\n{HOME_CARDS.strip()}\n\n{useful.strip()}\n"


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    missing: list[str] = []
    for title, rel in PAGES.items():
        wiki_file = wiki_path_for_title(title)
        if not wiki_file.exists():
            missing.append(title)
            continue
        out_file = OUT / rel
        out_file.parent.mkdir(parents=True, exist_ok=True)
        raw = wiki_file.read_text(encoding="utf-8")
        if title == "Home":
            content = build_homepage(raw)
        else:
            content = convert_content(raw, out_file)
        out_file.write_text(content, encoding="utf-8", newline="\n")

    (OUT / "SUMMARY.md").write_text(SUMMARY_LINES.strip() + "\n", encoding="utf-8", newline="\n")

    if missing:
        raise SystemExit(f"Missing wiki pages: {missing}")

    print(f"Migrated {len(PAGES)} pages to {OUT}")


if __name__ == "__main__":
    main()
