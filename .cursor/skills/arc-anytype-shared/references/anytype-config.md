# AnyType — ARC space (конфиг)

MCP-сервер: `user-anytype` (локальный `@anyproto/anytype-mcp`). AnyType Desktop должен быть запущен.

## Space

| Поле | Значение |
|------|----------|
| Название | Artist Reference Collection |
| `space_id` | `bafyreiatym7s6pb74pl53lc7dsldsoe6qv2n3yq62gvcbrbrlbk5su7o24.3tzcnbz8ajz22` |

## Типы

| Доска | `type_key` | `type_id` |
|-------|------------|-----------|
| Задачи | `task` | `bafyreifjrljfwzqotcacwkt324t4vnmzva3xuzcjcigrnc2dydhyfoakjy` |
| Баги | `bagi` | `bafyreihedq3u5ym3h4o75l45uc6vr3hkagn2mtg2afs4jsj7tij66u3pna` |

Доска **Баги** — представление типа `bagi` (отдельная коллекция не нужна).

## Статус (`property` key: `status`)

| Статус | `tag_id` | Когда ставить |
|--------|----------|---------------|
| Идея | `bafyreicpbv4isiwlsgwoklras57bvxrzdhtdjnhgabuammgeh74xd65hmu` | пожелание, не баг |
| Задача | `bafyreifuq4tpsf6t6b2ydpiskyu5a72u2vg5bu7ihazpzmmqyq63dkseke` | в бэклоге, ждёт работы |
| В работе | `bafyreig34si4yes2r24ecf64gkbbv5h6tqjixbxsab7aheygxkozgvts6y` | **только пользователь** переносит сюда |
| Готово | `bafyreicef43uzzdapp2aapoj627ip2x4xuw3iy4wuj2nq7y7ezouqa4eq4` | после фикса / отклонения |

`property_id` статуса: `bafyreiedjkqrgebmbxmrws6c4ki2rkksipaqa4gpj6lbbiv7ztcoxhtiou`

## Хабы документации (миграция из Notion)

| Раздел | Хаб (`object_id`) | Collection (`object_id`) |
|--------|-------------------|--------------------------|
| **Канал (home)** | `bafyreidtethsgsjhqirul4okqznbuzj4dxdhf2vde76rxgjishhmpfczim` | — |
| О проекте | `bafyreifikqliehilmxrstwioovfw6bvuvbnimjsshjqh35z2lta22s4ehi` | `bafyreiczzgchwkzfp2abcrs7x54rb4r7hebtubemhgc2fekcujlqqclcxq` |
| Knowledge Base | `bafyreic6lxnh72q6xyaz3gsmvubr3u3woplq42fkdhrwlfcuvswbmpjpuq` | `bafyreic7u4ww4yxbf3477xoylzk5jptb2vcp6xg5abn4hhc6mauecmhxei` |
| KB (архив) | `bafyreidnwugve2nev6kjo66op63ly5yjevd2ycexfao2hntscbxwykegz4` | `bafyreigbjebxwult63gpced5ynmeybgzoztvrrsuxksw347fauoiaobcoa` |
| ТЗ | `bafyreickvicikcsc27fhvpcupxtbqtnv65g67kaywnuusa7ytv2mx4xbkm` | `bafyreiaplmyqterh7t2446bpon3ksg2ali3azn2pozdjkgqoari5vnpm3y` |
| Дизайн-система | `bafyreiexjjh74pzxnupsmycm7xbnw57jwihjlypmezc2x43yc2bwmnl53m` | `bafyreihgn2qmksna3a2sju27vm4jkg5haox4wwjt4ozv2zsecasncdhjry` (UI компоненты) |
| UI элементы | `bafyreib6eqhdncgcku7gjucxv3pwxfk3xfsmqr52ve2gmkyl4xmuezi6ca` | см. коллекцию ДС |

Паттерн: **хаб (Page)** = описание раздела; **Collection** = список статей для навигации и переноса из Notion.

## Форма бэта-фидбэка

URL по умолчанию: `https://forms.yandex.ru/u/6a382e851f1eb55aed4c9c42`  
Документация виджета: `docs/bug-report-widget.md`

## MCP-вызовы (шпаргалка)

```
API-list-spaces          → space_id
API-search-space         → types: ["bagi"] | ["task"], limit 100
API-get-object           → format md, тело карточки
API-create-object        → type_key, name, body, properties[]
API-update-object        → status → Готово + доп. markdown с итогом
```

Фильтр «В работе»: `API-search-space` с `types`, затем отбор по `properties` где `status.select.name === "В работе"`.
