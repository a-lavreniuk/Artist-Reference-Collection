/**
 * Built-in EN↔RU art-reference synonyms for tag search.
 * Does not merge tags — only expands the query for matching.
 */
export const TAG_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['light', 'lighting', 'свет', 'освещение'],
  ['dark', 'darkness', 'тёмн', 'темн', 'тьма'],
  ['portrait', 'портрет'],
  ['landscape', 'пейзаж'],
  ['sketch', 'скетч', 'набросок'],
  ['drawing', 'рисунок'],
  ['painting', 'живопись', 'картина'],
  ['photo', 'photograph', 'фото'],
  ['character', 'персонаж'],
  ['anatomy', 'анатомия'],
  ['pose', 'поза'],
  ['reference', 'референс'],
  ['color', 'colour', 'цвет'],
  ['texture', 'текстура'],
  ['background', 'фон'],
  ['sky', 'небо'],
  ['water', 'вода'],
  ['forest', 'лес'],
  ['city', 'город'],
  ['night', 'ночь'],
  ['day', 'день'],
  ['sun', 'солнце'],
  ['shadow', 'тень'],
  ['metal', 'металл'],
  ['wood', 'дерево'],
  ['fabric', 'cloth', 'ткань'],
  ['hair', 'волосы'],
  ['face', 'лицо'],
  ['hand', 'hands', 'рука', 'руки'],
  ['eye', 'eyes', 'глаз', 'глаза'],
  ['animal', 'животное'],
  ['bird', 'птица'],
  ['vehicle', 'car', 'транспорт', 'машина'],
  ['architecture', 'архитектура'],
  ['interior', 'интерьер'],
  ['fashion', 'мода'],
  ['weapon', 'оружие'],
  ['armor', 'armour', 'броня'],
  ['fantasy', 'фэнтези', 'фентези'],
  ['sci-fi', 'scifi', 'фантастика'],
  ['concept', 'концепт'],
  ['illustration', 'иллюстрация'],
  ['watercolor', 'watercolour', 'акварель'],
  ['oil', 'масло'],
  ['ink', 'тушь', 'чернила'],
  ['pencil', 'карандаш'],
  ['lineart', 'line art', 'лайнарт'],
  ['render', 'рендер'],
  ['animation', 'анимация'],
  ['comic', 'комикс'],
  ['manga', 'манга'],
  ['anime', 'аниме'],
  ['realistic', 'realism', 'реалистичн', 'реализм'],
  ['stylized', 'стилизац'],
  ['cute', 'милый', 'kawaii'],
  ['horror', 'хоррор', 'ужас'],
  ['nature', 'природа'],
  ['plant', 'flower', 'растение', 'цветок'],
  ['tree', 'дерево'],
  ['mountain', 'гора'],
  ['cloud', 'облако'],
  ['fire', 'огонь'],
  ['ice', 'лёд', 'лед'],
  ['snow', 'снег'],
  ['rain', 'дождь'],
  ['smoke', 'дым'],
  ['expression', 'emotion', 'эмоция'],
  ['fullbody', 'full body', 'фуллбади', 'полный рост'],
  ['halfbody', 'half body', 'халфбади', 'по пояс'],
  ['closeup', 'close-up', 'close up', 'крупный план'],
  ['profile', 'профиль'],
  ['silhouette', 'силуэт'],
  ['environment', 'окружение'],
  ['magic', 'магия'],
  ['glow', 'свечение'],
  ['neon', 'неон'],
  ['robot', 'робот'],
  ['monster', 'монстр'],
  ['dragon', 'дракон']
];

function groupIntersectsQuery(group: readonly string[], q: string): boolean {
  for (const term of group) {
    if (term === q) return true;
    if (q.length >= 3 && term.startsWith(q)) return true;
    if (term.length >= 3 && q.startsWith(term)) return true;
  }
  return false;
}

/** Query plus related EN/RU terms from the dictionary. */
export function synonymSearchKeys(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: string[] = [q];
  const seen = new Set<string>([q]);
  for (const group of TAG_SYNONYM_GROUPS) {
    if (!groupIntersectsQuery(group, q)) continue;
    for (const term of group) {
      const t = term.toLowerCase();
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export function tagFieldsMatchQuery(name: string, description: string | undefined, query: string): boolean {
  const keys = synonymSearchKeys(query);
  if (keys.length === 0) return true;
  const n = name.toLowerCase();
  const d = description?.toLowerCase() ?? '';
  return keys.some((k) => n.includes(k) || d.includes(k));
}
