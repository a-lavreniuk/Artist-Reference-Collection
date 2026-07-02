# AnyType — ARC2 space (шаблон канала)

MCP-сервер: `user-anytype`. AnyType Desktop должен быть запущен.

Предыдущий space (данные до миграции): [anytype-config.md](./anytype-config.md).

## Space

| Поле | Значение |
|------|----------|
| Название | ARC2 |
| `space_id` | `bafyreieemp2d3uqeidutucs5fz4snpoekpwfvnj7j6zdz75av3pvqjgoxq.3tzcnbz8ajz22` |

## Типы

| Доска / контент | `type_key` | `type_id` |
|-----------------|------------|-----------|
| Задачи | `task` | `bafyreibksphkcoljgcvuiyh6473ho3xzufzqvtzekgqberawuyqy5x3mj4` |
| Баги | `bug` | `bafyreignzxfdxh7wfnvrro6wpbixkcuhyteeiojryzffx6gweaskpoh4qe` |
| Статья KB | `kb_article` | `bafyreib2s6xorwaqeyifw74do63wjaz3lgashhka4n5vlehackactjhpqa` |

## Статус задачи (`task_status`)

| Статус | `tag_id` |
|--------|----------|
| Идея | `bafyreigo7l76fllwjew3ym3vgvhap3xjs6krch7qnce32okuyfezgjtzte` |
| Задача | `bafyreigdce5mzarotiu424mfp4r4gfkfvwikpbuvagbxfmqxrdx6vr3r6e` |
| В работе | `bafyreibosotguqd2xlxwcez37gtn2ytlcqz57gabufznyx466322ouhr3e` |
| Готово | `bafyreihz7x4s2i3kmocphjyr653vammqoaxvzpzs3or4tofl53g6qjudqu` |

`property_id`: `bafyreiafd2bzisxpwgis4aafiqjrtridgqjnvi44a7xk5pdncvlpehbwfy`

## Статус бага (`bug_status`) — отдельно от задач

| Статус | `tag_id` |
|--------|----------|
| Бэклог | `bafyreiegr62owr4gscu5573hqwvrai7xc2iwu7slnwxvnr2vebumucakda` |
| Задача | `bafyreiavmfdklxox4knybzaq7muy3x6eobzdjlk3l2zpzwu4zvgd2krx3i` |
| В работе | `bafyreiakmxmpb3s4nsviykijalbvb7ktj4lvbpzc74kylooasor4wtpnzq` |
| На перепроверке | `bafyreigp2ywvbs7ivbjbqxyz4k6ixhjhsbop4twt5eb5i7tltdwqfkigeu` |
| Готово | `bafyreibegng6c5hj3tp5ss7ebvhtudt5k5ek6nslgcmausrsw6e4yznrpu` |

`property_id`: `bafyreiffiznez3iefflzzllz3blpzwi54zu5grnrlt7chuxwuwdeaeftke`

## Тип обращения (`report_type`)

| Значение | `tag_id` |
|----------|----------|
| Баг | `bafyreihzvkma6fdghaeeqmpdftibzl74d4dccbqpfvbtibmgwkzso4nywq` |
| Визуальная неточность | `bafyreiaih3mnjdbqbvmrpdsgzzoy4wum753mrglesopoptjo7yxbzpiwsq` |
| UX | `bafyreiabsowx5z452biwmc3eztymjsnqmb34xjlxuamwcacveme5qlukya` |
| Производительность | `bafyreifg4uvt5wdeqb3sj7gqiran5fclte4gxcgvimd2oacfr2fmo5rkky` |
| Идея | `bafyreiakcnnrpz7lxxmzptmw2ijtf7wfjf3d2chfo3e3b6iat2buzksnka` |

`property_id`: `bafyreidcbib55emmuzf3u4nzpzomvllwtqi7qvtlgd7rwqzcr7ufipvhmy`

## Насколько мешает (`severity`)

| Значение | `tag_id` |
|----------|----------|
| Блокер | `bafyreiebtmiksnq5tylof5t7mc7zjlrskzbu53r2dunw5gzs25bcrgry34` |
| Серьезно | `bafyreiasvacqc4omj7op6p2bwlp7klsc4p35k2uzswt7rdrjueq6labqae` |
| Мелочь | `bafyreifhw55vdcfmqihppd6uchg7fy6i2v7qvjgs2gifztagdmlzo3dyve` |
| Не мешает | `bafyreihwknha33p5he2n33z2r5z7vcedzppsvc34q3737xaq2shheymy6u` |

`property_id`: `bafyreifvxyniokop3adwiw3rdpln2ioyjtcdpmxlcvn6rcenoqstklgcou`

## Метки Cursor (`cursor`, multi_select)

| Метка | `tag_id` |
|-------|----------|
| Хотфикс | `bafyreibmtiqjrvj4paj6nz2krjbowgtdcitnzlh6m2lgihxc53ymx7ihhi` |
| Нужна ветка | `bafyreibo2pav3cwoaogudw6v2adzbjoaymgmptdbztccaauhaii2guqe2e` |
| Нужен план | `bafyreifcf2ho6roobws2q7o5omeudmmjuluzsab2ttv4ysajb3bdjxxu44` |

`property_id`: `bafyreicu3vluwuty7j5n4mlq256gf653axtrkfmtup2rplaucvrk274hde`

## Тип документа KB (`doc_type`)

| Квадрант | `tag_id` |
|----------|----------|
| Туториал | `bafyreicsqx5ulzi332xes5gqofoafgl6p6ejl7dujzznsc2omad6ko3w2e` |
| How-to | `bafyreiasqfs6e6xg7khqxlza2phgmbagtl7jv2yoyutrxflshtloid2gwe` |
| Справочник | `bafyreiayyqurc7ubc4jwggnrfot2h5btqschpreoggaajobhy2vpy6k7ci` |
| Объяснение | `bafyreichzkkfrzn54h3uqjq7x7b6apb6xj56eo4fymemax6o2yvunv3nrm` |

`property_id`: `bafyreig3qnb3moiezdwmmzkn73jnt2blwymylfg7naye5yzpvktrkto5xm`

## Аудитория (`audience`)

| Значение | `tag_id` |
|----------|----------|
| Публичное | `bafyreifi3fkmkmbah3sohodyrxil7qn4e5rk5ey7d3ageavovmp42jb4qq` |
| Внутреннее | `bafyreiezbxq6htkvuzo6sjw5npgeb5pj26z5bf7sjm2ywrtiyhvyhqj7cq` |
| Черновик | `bafyreih2oixdn5yukqb7ay3lvyk3kg6heicc3kahejmct3ecd3sxtxggvq` |

## Канал — pin в сайдбар (плоская модель)

**Правило:** пункт сайдбара → сразу контент. Страницы = Page. Только Задачи и Баги = Set + Kanban.

| # | Пункт | `object_id` | Тип |
|---|-------|-------------|-----|
| 1 | Home | `bafyreicvxvivp2jbi6vjtphht6cz5czcu5ctguvghj5lxnkdzv2lc72bry` | Page |
| 2 | Задачи | `bafyreifq72jqknugnq6pkwcsws4ycmuwkte3i3phd24k7pt5w7tv2ja5zm` | Set → Kanban |
| 3 | Баги | `bafyreiftacjchhjnscta5zobljetm4v3cauzu4decsrj5vqrra4fokdxve` | Set → Kanban |
| 4 | Knowledge Base | `bafyreid4sh2jygakxaczzmlbhqvho5ljyqan3xnn6a3qwvqkq6cshj7iuu` | Page |
| 5 | Дизайн-система | `bafyreiac456ceea7pzepinrrb7sq5kkagxjy6qialepzsij5hegdr2g6r4` | Page |

**Не в сайдбар:** `Служебное` (`bafyreiadiv6tt6opx3gjm53nddpv6w3nj2ukzd3oqjx6nffeuimjvhuuum`), отдельные статьи, `UI элементы` / `Токены` / `Паттерны` (открываются со страницы ДС).

Настройка Kanban: [arc2-desktop-setup.md](./arc2-desktop-setup.md).

## Knowledge Base — статьи (тип `kb_article`, не в сайдбаре)

Ссылки с страницы Knowledge Base. Поле `doc_type` — для классификации, не для отдельных Query.

| Статья | `object_id` |
|--------|-------------|
| Первый запуск ARC | `bafyreid5j6pbfqh2ygmpft3zrbguvm4zmacswaasv3u7ywcutjpe53fjty` |
| Как сообщить о баге | `bafyreihfc7pzxuk3bvsnfcv55ajigesnpaw7zqxa4iqtluopmatjwzje4e` |
| Горячие клавиши | `bafyreiawqvjradappbssbl63p37ewweligedqluek3khfwzpak52xzbjte` |
| О проекте ARC | `bafyreicas2ddjal3n3w77qssr7ptk2gsfwi243qpb6lnyoa63q3yzmswhm` |

## Дизайн-система — дочерние разделы (со страницы ДС, не в сайдбаре)

Контент встроен в Page «Дизайн-система»; отдельных Page «Токены» / «Паттерны» нет.

## Важно: «Pages» в сайдбаре ≠ навигация

Блок **Objects → Pages** — каталог **всех** страниц space (как папка «все файлы»). Это не меню проекта.

**Скрыть:** ПКМ по секции **Objects** (или **Types**) → **Скрыть раздел**. Работать только через **Pinned** (5 пунктов).

После очистки в **Pages** должно остаться **3** объекта: Home, Knowledge Base, Дизайн-система.

## Шаблоны карточек (тип Задача / Баг, в «Служебное», не Page)

| Шаблон | `object_id` |
|--------|-------------|
| Карточка задачи | `bafyreifacebc3q4kkhqk2p3yq6addvbuzpblkvgurgdofn3fy6lyizeqly` |
| Баг-репорт | `bafyreifewcoybsbdslz2lvxxjbjhk5jcptn5n7r324ofdboinhanme7cnq` |
| Статья KB | `bafyreiagcuk476esmom3dvplax3nzqm2rhqqklrnuaew6gwsquh4eab4pq` |

## MCP (ARC2)

```
API-search-space  → space_id выше, types: ["task"] | ["bug"]
Статус задачи     → property key: task_status
Статус бага       → property key: bug_status
```

Форма бэта-фидбэка: `https://forms.yandex.ru/u/6a382e851f1eb55aed4c9c42` (см. `docs/bug-report-widget.md`).

## Миграция с Artist Reference Collection

Старый space не изменён. После переноса задач/багов/контента переключить skills `arc-anytype-tasks` и `arc-anytype-bugs` на этот конфиг (`type_key: bug`, `bug_status` вместо общего `status`).
