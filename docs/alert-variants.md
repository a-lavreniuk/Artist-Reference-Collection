# Alert variants (ARC)

Макет: [Figma Alert, node 52:2131](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=52-2131).

## Варианты (`AlertVariant`)

| Variant | Figma | Когда использовать |
|---------|-------|-------------------|
| `success` | Success | Операция завершена успешно: импорт, скриншот, автоимпорт, очистка корзины, установка/обновление модели, бэкап готов, copy-to-clipboard |
| `warning` | Warning | Нужно внимание, ошибка восстановима: дубликаты, нехватка места (не critical), сбои проверки/скачивания обновлений и AI-модели |
| `danger` | Error | Критическая ошибка или блокирующий сбой: critical disk, ошибки бэкапа/восстановления, валидация «папка не пуста» |
| `info` | Information | Нейтральный статус, прогресс, справка: прогресс импорта/бэкапа, «последняя версия», удаление/переключение модели (реиндексация) |
| `brand` | Brand | Акцентное продуктовое действие ARC: добавление в мудборд и аналогичные ключевые действия продукта |

## Паттерны UI

### ToastAlert (`renderer/src/components/alert/ToastAlert.tsx`)

- Фиксированный блок внизу экрана (`.demo-alert-host`)
- Одна строка текста + кнопка закрытия
- Auto-dismiss по умолчанию 3200 ms (`autoDismissMs={0}` — progress toast)
- Звук: `success` / `warning` / `danger` — свои; `info` и `brand` — `info.mp3`
- Глобальные toast: `showAppNotification()` → `NotificationHost`

### InlineNotice (`renderer/src/components/alert/InlineNotice.tsx`)

- Блок в потоке страницы: заголовок + текст + опциональные кнопки
- Без крестика и без auto-dismiss
- Пример: предупреждение о диске на странице статистики

## Таблица текущих кейсов

| Ситуация | Паттерн | Variant | prefKey | Звук | Dismiss |
|----------|---------|---------|---------|------|---------|
| Файл добавлен | Toast | success | notifyFilesAdded | да | auto |
| Автоимпорт | Toast | success | notifyAutoImport | да | auto |
| Скриншот сохранён | Toast | success | notifyScreenshotSaved | да | auto |
| Корзина очищена | Toast | success | — | да | auto |
| Дубликаты найдены | Toast | warning | notifyDuplicatesFound | да | auto |
| Диск: warning/critical | Toast + Inline | warning / danger | skipPrefCheck | да | auto / — |
| Импорт в процессе | Toast | info | — | нет | persistent |
| Бэкап в процессе | Toast | info | — | нет | persistent |
| Бэкап готов | Toast | success | — | да | auto |
| Ошибка бэкапа/restore | Toast | danger | — | да | auto |
| Последняя версия ARC | Toast | info | — | да | auto |
| Сбой обновлений / AI | Toast | warning | — | да | auto |
| Модель установлена/обновлена | Toast | success | — | да | auto |
| Модель удалена / переключена | Toast | info | — | да | auto |
| Карточка в мудборд | Toast | brand | — | да | auto |
| Copy в карточке | Toast | success | — | да | auto |

## Антипаттерны

- Не использовать alert для inline-валидации полей форм (см. `.cursor/rules/Input-validation-no-inline-errors.mdc`)
- Не дублировать toast и inline для одного и того же события без продуктовой необходимости
- `brand` — только для акцентных продуктовых действий, не для каждого `success`

## CSS

Семантические токены `--alert-*` задаются в `theme-light.css` (генератор `scripts/generate-light-theme-css.mjs`) для Dark/Default и Light/Default elevation. Классы: `.alert-success`, `.alert-warning`, `.alert-danger`, `.alert-info`, `.alert-brand`.
