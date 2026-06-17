import {
  CATEGORY_WEIGHT_SCORE,
  type CategoryRecord,
  type CategoryWeight,
  type TagRecord
} from '../services/db';

export type RankedSearchTag = {
  tag: TagRecord;
  category: CategoryRecord;
  score: number;
};

const NAME_PREFIX = 1000;
const NAME_CONTAINS = 800;
const DESC_PREFIX = 400;
const DESC_CONTAINS = 200;

function scoreTagMatch(tag: TagRecord, weight: CategoryWeight, q: string): number | null {
  const name = tag.name.toLowerCase();
  const desc = tag.description?.trim().toLowerCase() ?? '';
  const boost = CATEGORY_WEIGHT_SCORE[weight];

  if (name.startsWith(q)) return NAME_PREFIX + boost;
  if (name.includes(q)) return NAME_CONTAINS + boost;
  if (desc && desc.startsWith(q)) return DESC_PREFIX + boost;
  if (desc && desc.includes(q)) return DESC_CONTAINS + boost;
  return null;
}

/** Ранжирование меток для инвертированного поиска: имя → описание → вес категории. */
export function rankTagsForQuery(
  query: string,
  categories: CategoryRecord[],
  tagsByCategory: Map<string, TagRecord[]>
): RankedSearchTag[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const ranked: RankedSearchTag[] = [];

  for (const [categoryId, tags] of tagsByCategory) {
    const category = categoryById.get(categoryId);
    if (!category) continue;
    for (const tag of tags) {
      const score = scoreTagMatch(tag, category.weight, q);
      if (score !== null) ranked.push({ tag, category, score });
    }
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tag.name.localeCompare(b.tag.name, 'ru');
  });

  return ranked;
}

export type TagNameHighlightSegment = {
  text: string;
  match: boolean;
};

/** Разбивает имя метки для подсветки совпадения с запросом (Figma 890-9941). */
export function splitTagNameForHighlight(name: string, query: string): TagNameHighlightSegment[] {
  const q = query.trim();
  if (!q) return [{ text: name, match: false }];

  const lowerName = name.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerName.indexOf(lowerQ);
  if (idx === -1) return [{ text: name, match: false }];

  const segments: TagNameHighlightSegment[] = [];
  if (idx > 0) segments.push({ text: name.slice(0, idx), match: false });
  segments.push({ text: name.slice(idx, idx + q.length), match: true });
  if (idx + q.length < name.length) segments.push({ text: name.slice(idx + q.length), match: false });
  return segments;
}
