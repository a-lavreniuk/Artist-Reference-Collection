# AnyType — константы ARC

Space: **Artist Reference Collection**

Единая доска **Таски** (`task`). Задачи и баги различаются полем **Тип задачи** (`tip_zadachi`).

| Ключ | Значение |
|------|----------|
| `space_id` | `bafyreiatym7s6pb74pl53lc7dsldsoe6qv2n3yq62gvcbrbrlbk5su7o24.3tzcnbz8ajz22` |
| `type_key` (все карточки) | `task` |
| `type_id` доски Таски | `bafyreifjrljfwzqotcacwkt324t4vnmzva3xuzcjcigrnc2dydhyfoakjy` |
| `tip_zadachi` property key | `tip_zadachi` |
| tag id «Тип задачи → Задача» | `bafyreihyc7utnvzss5wmg6tfsofglomjlftyx53aprdxgkeqtjtpnjhvpy` |
| tag id «Тип задачи → Баг» | `bafyreiazrg2sjm4no2nhnbkrjznyr6csxpqtxzrz2asah3xjukkqipnsji` |
| `status` property key | `status` |
| tag id «Готово» | `bafyreicef43uzzdapp2aapoj627ip2x4xuw3iy4wuj2nq7y7ezouqa4eq4` |
| tag id «В работе» | `bafyreig34si4yes2r24ecf64gkbbv5h6tqjixbxsab7aheygxkozgvts6y` |

**Устарело:** `type_key: "bagi"` — не использовать для новых карточек.

MCP server: `user-anytype`.

При смене space или тегов в AnyType — обновить эту таблицу.
