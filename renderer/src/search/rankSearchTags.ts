import {
  CATEGORY_WEIGHT_SCORE,
  type CategoryRecord,
  type CategoryWeight,
  type TagRecord
} from '../services/db';
import { synonymSearchKeys } from './tagSynonymMap';

export type RankedSearchTag = {
  tag: TagRecord;
  category: CategoryRecord;
  score: number;
};

const NAME_PREFIX = 1000;
const NAME_CONTAINS = 800;
const SYNONYM_PREFIX = 700;
const SYNONYM_CONTAINS = 600;
const DESC_PREFIX = 400;
const DESC_CONTAINS = 200;
const SYNONYM_DESC_PREFIX = 350;
const SYNONYM_DESC_CONTAINS = 150;
const SEMANTIC_SCORE_BASE = 500;

function scoreAgainstKey(
  name: string,
  desc: string,
  boost: number,
  key: string,
  fromSynonym: boolean
): number | null {
  const prefix = fromSynonym ? SYNONYM_PREFIX : NAME_PREFIX;
  const contains = fromSynonym ? SYNONYM_CONTAINS : NAME_CONTAINS;
  const descPrefix = fromSynonym ? SYNONYM_DESC_PREFIX : DESC_PREFIX;
  const descContains = fromSynonym ? SYNONYM_DESC_CONTAINS : DESC_CONTAINS;
  if (name.startsWith(key)) return prefix + boost;
  if (name.includes(key)) return contains + boost;
  if (desc && desc.startsWith(key)) return descPrefix + boost;
  if (desc && desc.includes(key)) return descContains + boost;
  return null;
}

function scoreTagMatch(tag: TagRecord, weight: CategoryWeight, q: string): number | null {
  const name = tag.name.toLowerCase();
  const desc = tag.description?.trim().toLowerCase() ?? '';
  const boost = CATEGORY_WEIGHT_SCORE[weight];
  let best: number | null = null;
  for (const key of synonymSearchKeys(q)) {
    const fromSynonym = key !== q;
    const score = scoreAgainstKey(name, desc, boost, key, fromSynonym);
    if (score != null && (best == null || score > best)) best = score;
  }
  return best;
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

export function mergeSemanticTagHits(
  ranked: RankedSearchTag[],
  hits: Array<{ tagId: string; score: number }>,
  categories: CategoryRecord[],
  tagsByCategory: Map<string, TagRecord[]>
): RankedSearchTag[] {
  if (hits.length === 0) return ranked;
  const seen = new Set(ranked.map((row) => row.tag.id));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const tagIndex = new Map<string, { tag: TagRecord; category: CategoryRecord }>();
  for (const [categoryId, tags] of tagsByCategory) {
    const category = categoryById.get(categoryId);
    if (!category) continue;
    for (const tag of tags) tagIndex.set(tag.id, { tag, category });
  }
  const extra: RankedSearchTag[] = [];
  for (const hit of hits) {
    if (seen.has(hit.tagId)) continue;
    const found = tagIndex.get(hit.tagId);
    if (!found) continue;
    extra.push({
      tag: found.tag,
      category: found.category,
      score: SEMANTIC_SCORE_BASE + hit.score * 100
    });
    seen.add(hit.tagId);
  }
  if (extra.length === 0) return ranked;
  const merged = [...ranked, ...extra];
  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tag.name.localeCompare(b.tag.name, 'ru');
  });
  return merged;
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
