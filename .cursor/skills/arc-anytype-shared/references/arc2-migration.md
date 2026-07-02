# ARC2 — план миграции контента (фаза C)

Скелет space **ARC2** создан. Старый space **Artist Reference Collection** не изменён.

## Пакеты переноса

1. **Задачи и баги** — вручную или скриптом: копировать карточки, маппить `status` → `task_status` / `bug_status`.
2. **Knowledge Base** — из Notion KB v2 в квадранты How-to / Справочник; «О проекте», ТЗ, механики → Объяснения.
3. **Дизайн-система** — UI-страницы из текущего ARC space (`anytype-config.md`, раздел ДС).
4. **Skills** — после переключения работать только с [anytype-config-arc2.md](./anytype-config-arc2.md).

## Notion (источники)

| Раздел | Notion page id |
|--------|----------------|
| О проекте | `33bbfa9fcc588072a9bef5b4815b8b81` |
| KB v2 | `38ebfa9fcc58812b9741d3ef63f366d0` |
| KB архив | `380bfa9fcc58803f89b1a91493fcac3c` |
| ТЗ | `36cbfa9fcc5880df8a38da6d96219484` |
| UI элементы | `36cbfa9fcc5880088082cf5a33b9ed5d` |

## После миграции

- Обновить default config в skills или явно указывать «работаем в ARC2».
- Архивировать или скрыть старый space из ежедневной работы.
