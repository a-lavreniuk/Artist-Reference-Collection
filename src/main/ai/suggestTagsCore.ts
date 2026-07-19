export type SuggestTagsMatch = {
  tagId: string;
  name: string;
  score: number;
  via: 'exact' | 'embedding' | 'created';
};

export type AutoTagVolumeParams = {
  maxCandidates: number;
  minSimilarity: number;
  promptCount: number;
};

export type SuggestTagCatalogEntry = {
  id: string;
  name: string;
  /** Описание метки из настроек (короткое или длинное — одно поле в ARC). */
  description?: string;
};

export function normalizeTagCandidate(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Тексты для сопоставления: название, короткое описание (первое предложение),
 * полное описание, комбинация «название + описание».
 */
export function tagMatchTexts(tag: SuggestTagCatalogEntry): string[] {
  const name = tag.name.trim();
  const desc = tag.description?.trim() ?? '';
  const texts: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = normalizeTagCandidate(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    texts.push(trimmed);
  };

  push(name);

  if (desc) {
    const sentenceEnd = desc.search(/[.!?…](?:\s|$)/);
    const shortDesc =
      sentenceEnd > 0 && sentenceEnd < desc.length - 1 ? desc.slice(0, sentenceEnd + 1).trim() : desc;
    push(shortDesc);
    push(desc);
    push(`${name}. ${shortDesc}`);
    if (shortDesc !== desc) {
      push(`${name}. ${desc}`);
    }
  }

  return texts;
}

/** Разбор ответа JoyCaption в список кандидатов-меток. */
export function parseTagCandidates(raw: string): string[] {
  const text = raw.replace(/\r/g, '\n').trim();
  if (!text) return [];

  const parts = text
    .split(/[\n,;•·|]+|(?:\s[-–—]\s)/)
    .map((p) =>
      p
        .replace(/^\s*[\d]+[.)]\s*/, '')
        .replace(/^[-*•]\s*/, '')
        .replace(/^["«]|["»]$/g, '')
        .trim()
    )
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (part.length < 2 || part.length > 64) continue;
    if (/[.!?]$/.test(part) && part.split(/\s+/).length > 4) continue;
    const key = normalizeTagCandidate(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(part.trim());
  }
  return out;
}

export function volumeParamsForAutoTag(volume: number): AutoTagVolumeParams {
  const v = Math.max(0, Math.min(100, Math.round(volume)));
  // Чуть строже mid/high — меньше ложных CLIP-совпадений в каталоге пользователя.
  if (v <= 33) return { maxCandidates: 5, minSimilarity: 0.84, promptCount: 5 };
  if (v <= 66) return { maxCandidates: 10, minSimilarity: 0.76, promptCount: 10 };
  return { maxCandidates: 16, minSimilarity: 0.68, promptCount: 16 };
}

/** Позиции кадров для автотега видео (мс). До 3 кадров. */
export function videoFrameOffsetsMs(durationMs: number | null): number[] {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return [0, 3000, 10000];
  }
  if (durationMs < 1500) return [0];
  if (durationMs < 6000) return [0, Math.floor(durationMs / 2)];
  const a = Math.floor(durationMs * 0.15);
  const b = Math.floor(durationMs * 0.5);
  const c = Math.floor(durationMs * 0.85);
  return [...new Set([a, b, c])].sort((x, y) => x - y);
}

export function buildAutoTagPrompt(promptCount: number): string {
  return (
    `Перечисли до ${promptCount} коротких меток на русском через запятую. ` +
    `Темы: объект или персонаж, жанр, стиль / техника, настроение, композиция или ракурс. ` +
    `Только отдельные слова или короткие словосочетания (1–3 слова). ` +
    `Без предложений, нумерации, кавычек и пояснений. ` +
    `Не дублируй синонимы и уточнения одного понятия ` +
    `(не пиши одновременно «портрет» и «женский портрет», «неон» и «неоновый свет»). ` +
    `Предпочитай привычные каталожные формулировки, а не редкие метафоры.`
  );
}

export const AUTO_CREATED_CATEGORY_NAME = 'Автоматически созданные метки';


function descriptionContainsCandidate(description: string, candidateNorm: string): boolean {
  const descNorm = normalizeTagCandidate(description);
  if (!descNorm || !candidateNorm) return false;
  if (descNorm === candidateNorm) return true;
  // Целая фраза как отдельный фрагмент (пробелы / знаки).
  const escaped = candidateNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s,.;:!?«»"'-])${escaped}(?:$|[\\s,.;:!?«»"'-])`, 'i').test(descNorm);
}

export function matchCandidatesExact(
  candidates: string[],
  tags: SuggestTagCatalogEntry[]
): { matched: SuggestTagsMatch[]; unmatched: string[] } {
  const byName = new Map<string, SuggestTagCatalogEntry>();
  for (const tag of tags) {
    byName.set(normalizeTagCandidate(tag.name), tag);
  }

  const matched: SuggestTagsMatch[] = [];
  const unmatched: string[] = [];
  const usedIds = new Set<string>();

  for (const candidate of candidates) {
    const candNorm = normalizeTagCandidate(candidate);
    const byExactName = byName.get(candNorm);
    if (byExactName && !usedIds.has(byExactName.id)) {
      usedIds.add(byExactName.id);
      matched.push({ tagId: byExactName.id, name: byExactName.name, score: 1, via: 'exact' });
      continue;
    }

    let hit: SuggestTagCatalogEntry | null = null;
    for (const tag of tags) {
      if (usedIds.has(tag.id)) continue;
      for (const text of tagMatchTexts(tag)) {
        const textNorm = normalizeTagCandidate(text);
        if (textNorm === candNorm || descriptionContainsCandidate(text, candNorm)) {
          hit = tag;
          break;
        }
      }
      if (hit) break;
    }

    if (hit) {
      usedIds.add(hit.id);
      matched.push({ tagId: hit.id, name: hit.name, score: 0.95, via: 'exact' });
    } else {
      unmatched.push(candidate);
    }
  }

  return { matched, unmatched };
}
