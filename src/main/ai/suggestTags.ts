import { app, BrowserWindow } from 'electron';

import { readAppPreferences } from '../appPreferences';
import { readLibraryRootFromDisk } from '../libraryRootConfig';
import {
  ensureLibraryReady,
  getCardByIdFromDb,
  listAllTags,
  listCategories,
  updateCardInStorage
} from '../storage/libraryStorage';
import { cosineSimilarity } from '../storage/cardEmbeddings';
import { createCategory, createTag } from '../mcp/tagCatalogService';
import { isModelInstalled } from './modelManager';
import { generateJoyCaption } from './joyCaption';
import { ensureLightClipForHybrid } from './aiEmbeddingService';
import { embedTextInWorker, getModelsDir } from './aiWorkerBridge';
import { prepareSearchQuery } from './queryPrep';
import { resolveVisionFrames } from './visionFrames';
import {
  AUTO_CREATED_CATEGORY_NAME,
  buildAutoTagPrompt,
  matchCandidatesExact,
  normalizeTagCandidate,
  parseTagCandidates,
  tagMatchTexts,
  volumeParamsForAutoTag,
  type SuggestTagCatalogEntry,
  type SuggestTagsMatch
} from './suggestTagsCore';

export type SuggestTagsResult =
  | {
      ok: true;
      cardId: string;
      candidates: string[];
      matched: SuggestTagsMatch[];
      tagIds: string[];
      createdCount: number;
      /** Кандидаты без match в каталоге (когда create отключён / MCP dry-run). */
      proposedNew: string[];
    }
  | { ok: false; error: string };

export {
  AUTO_CREATED_CATEGORY_NAME,
  buildAutoTagPrompt,
  matchCandidatesExact,
  normalizeTagCandidate,
  parseTagCandidates,
  tagMatchTexts,
  videoFrameOffsetsMs,
  volumeParamsForAutoTag,
  type SuggestTagCatalogEntry,
  type SuggestTagsMatch,
  type AutoTagVolumeParams
} from './suggestTagsCore';

const textEmbedCache = new Map<string, Float32Array>();

async function embedText(text: string, modelId: string, modelsDir: string): Promise<Float32Array> {
  const key = normalizeTagCandidate(text);
  const cached = textEmbedCache.get(key);
  if (cached) return cached;
  const prepared = await prepareSearchQuery(text, modelsDir);
  const vector = await embedTextInWorker(prepared, modelId);
  const arr = Float32Array.from(vector);
  textEmbedCache.set(key, arr);
  return arr;
}

export async function matchCandidatesByEmbedding(
  candidates: string[],
  tags: SuggestTagCatalogEntry[],
  options: { minSimilarity: number; usedIds: Set<string>; modelId: string; modelsDir: string }
): Promise<{ matched: SuggestTagsMatch[]; unmatched: string[] }> {
  if (candidates.length === 0 || tags.length === 0) {
    return { matched: [], unmatched: [...candidates] };
  }

  const tagVectors: Array<{ id: string; name: string; vectors: Float32Array[] }> = [];
  for (const tag of tags) {
    if (options.usedIds.has(tag.id)) continue;
    const texts = tagMatchTexts(tag);
    const vectors: Float32Array[] = [];
    for (const text of texts) {
      vectors.push(await embedText(text, options.modelId, options.modelsDir));
    }
    if (vectors.length > 0) {
      tagVectors.push({ id: tag.id, name: tag.name, vectors });
    }
  }

  const matched: SuggestTagsMatch[] = [];
  const unmatched: string[] = [];
  for (const candidate of candidates) {
    const candVec = await embedText(candidate, options.modelId, options.modelsDir);
    let best: SuggestTagsMatch | null = null;
    for (const tag of tagVectors) {
      if (options.usedIds.has(tag.id)) continue;
      let score = 0;
      for (const vector of tag.vectors) {
        score = Math.max(score, cosineSimilarity(candVec, vector));
      }
      if (score < options.minSimilarity) continue;
      if (!best || score > best.score) {
        best = { tagId: tag.id, name: tag.name, score, via: 'embedding' };
      }
    }
    if (best) {
      options.usedIds.add(best.tagId);
      matched.push(best);
    } else {
      unmatched.push(candidate);
    }
  }
  return { matched, unmatched };
}

export function ensureAutoCreatedCategory(libraryRoot: string) {
  const existing = listCategories(libraryRoot).find(
    (c) => normalizeTagCandidate(c.name) === normalizeTagCandidate(AUTO_CREATED_CATEGORY_NAME)
  );
  if (existing) return existing;
  return createCategory(libraryRoot, {
    name: AUTO_CREATED_CATEGORY_NAME,
    colorHex: '#64748B',
    weight: 'low',
    description: 'Метки, созданные автоматически. Можно перенести в свои категории.'
  });
}

function createTagsFromCandidates(
  libraryRoot: string,
  candidates: string[],
  usedIds: Set<string>,
  limit: number
): SuggestTagsMatch[] {
  if (limit <= 0 || candidates.length === 0) return [];
  const category = ensureAutoCreatedCategory(libraryRoot);
  const created: SuggestTagsMatch[] = [];
  const remaining = [...candidates];

  while (created.length < limit && remaining.length > 0) {
    const name = remaining.shift()!;
    const norm = normalizeTagCandidate(name);
    if (!norm) continue;

    const allTags = listAllTags(libraryRoot);
    const existing = allTags.find((t) => normalizeTagCandidate(t.name) === norm);
    if (existing) {
      if (!usedIds.has(existing.id)) {
        usedIds.add(existing.id);
        created.push({ tagId: existing.id, name: existing.name, score: 0.9, via: 'exact' });
      }
      continue;
    }

    try {
      const tag = createTag(libraryRoot, { categoryId: category.id, name: name.trim() });
      usedIds.add(tag.id);
      created.push({ tagId: tag.id, name: tag.name, score: 0.55, via: 'created' });
      clearAutoTagNameEmbedCache();
    } catch {
      const again = listAllTags(libraryRoot).find((t) => normalizeTagCandidate(t.name) === norm);
      if (again && !usedIds.has(again.id)) {
        usedIds.add(again.id);
        created.push({ tagId: again.id, name: again.name, score: 0.9, via: 'exact' });
      }
    }
  }

  return created;
}

export type SuggestTagsOptions = {
  /**
   * Создавать несматченные метки в «Автоматически созданные метки».
   * Для MCP read-only передавайте false — тогда они уйдут в `proposedNew`.
   * По умолчанию — как в настройках (`reuse_create`).
   */
  allowCreate?: boolean;
};

export async function suggestTagsForCard(
  cardId: string,
  options: SuggestTagsOptions = {}
): Promise<SuggestTagsResult> {
  const prefs = await readAppPreferences();
  if (!prefs.aiSemanticSearchEnabled) {
    return { ok: false, error: 'Включите AI Поиск в настройках.' };
  }
  if (!prefs.aiAutoTagEnabled) {
    return {
      ok: false,
      error: 'Включите автотегирование в Настройки → Автотегирование.'
    };
  }

  const userData = app.getPath('userData');
  if (!(await isModelInstalled(userData, 'heavy'))) {
    return {
      ok: false,
      error: 'Нужна тяжёлая модель (JoyCaption). Установите её в Настройки → AI Поиск.'
    };
  }

  const root = await readLibraryRootFromDisk();
  if (!root) return { ok: false, error: 'Библиотека не открыта.' };
  await ensureLibraryReady(root);

  const vision = await resolveVisionFrames(root, cardId, { tempPrefix: '_autotag_frame' });
  if ('error' in vision) {
    return {
      ok: false,
      error:
        vision.error === 'Доступно только для изображений и видео.'
          ? 'Автотегирование доступно только для изображений и видео.'
          : vision.error
    };
  }

  // Не конкурировать с навигацией UI и сериализовать JoyCaption с индексацией.
  const { waitForNavigationIpc } = await import('../ipcNavigationPriority');
  await waitForNavigationIpc();

  const volume = volumeParamsForAutoTag(prefs.aiAutoTagVolume);
  const resources = {
    threads: prefs.aiThreads,
    gpuLayers: prefs.aiGpuLayers,
    maxRamMb: prefs.aiMaxRamMb
  };

  const promptPerFrame = Math.max(
    3,
    Math.ceil(volume.promptCount / Math.max(1, vision.framePaths.length))
  );
  const mergedCandidates: string[] = [];
  const seenCand = new Set<string>();

  try {
    for (const framePath of vision.framePaths) {
      let rawCaption: string;
      try {
        rawCaption = await generateJoyCaption(
          userData,
          framePath,
          resources,
          undefined,
          buildAutoTagPrompt(promptPerFrame)
        );
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        if (/ECONNREFUSED|fetch failed|caption failed/i.test(raw)) {
          return {
            ok: false,
            error:
              'Модель сейчас занята или не отвечает. Подождите окончания индексации и попробуйте снова.'
          };
        }
        return { ok: false, error: raw };
      }
      for (const part of parseTagCandidates(rawCaption)) {
        const key = normalizeTagCandidate(part);
        if (!key || seenCand.has(key)) continue;
        seenCand.add(key);
        mergedCandidates.push(part);
      }
    }
  } finally {
    await vision.cleanup();
  }

  const candidates = mergedCandidates.slice(0, volume.promptCount);
  if (candidates.length === 0) {
    return {
      ok: false,
      error: 'Модель не вернула список меток. Попробуйте ещё раз или измените объём меток в настройках.'
    };
  }

  const tags: SuggestTagCatalogEntry[] = listAllTags(root).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description
  }));

  const exact = matchCandidatesExact(candidates, tags);
  const usedIds = new Set(exact.matched.map((m) => m.tagId));
  let embeddingMatches: SuggestTagsMatch[] = [];
  let stillUnmatched = exact.unmatched;

  if (tags.length > 0 && stillUnmatched.length > 0) {
    try {
      const modelId = await ensureLightClipForHybrid();
      const modelsDir = getModelsDir();
      const embedResult = await matchCandidatesByEmbedding(stillUnmatched, tags, {
        minSimilarity: volume.minSimilarity,
        usedIds,
        modelId,
        modelsDir
      });
      embeddingMatches = embedResult.matched;
      stillUnmatched = embedResult.unmatched;
    } catch {
      // Exact-only fallback if CLIP unavailable
    }
  }

  const allowCreate =
    options.allowCreate !== undefined
      ? options.allowCreate
      : prefs.aiAutoTagCatalogMode === 'reuse_create';

  let createdMatches: SuggestTagsMatch[] = [];
  const remainingSlots = Math.max(0, volume.maxCandidates - exact.matched.length - embeddingMatches.length);
  if (allowCreate && remainingSlots > 0 && stillUnmatched.length > 0) {
    createdMatches = createTagsFromCandidates(root, stillUnmatched, usedIds, remainingSlots);
    stillUnmatched = stillUnmatched.filter(
      (c) => !createdMatches.some((m) => normalizeTagCandidate(m.name) === normalizeTagCandidate(c))
    );
  }

  const matched = [...exact.matched, ...embeddingMatches, ...createdMatches].slice(
    0,
    volume.maxCandidates
  );
  const proposedNew = allowCreate ? [] : stillUnmatched.slice(0, remainingSlots);

  return {
    ok: true,
    cardId,
    candidates,
    matched,
    tagIds: matched.map((m) => m.tagId),
    createdCount: createdMatches.filter((m) => m.via === 'created').length,
    proposedNew
  };
}

/**
 * После heavy-индексации или для видео после импорта: suggest + merge меток.
 */
export async function applyAutoTagsAfterIndex(cardId: string): Promise<{ added: number; created: number } | null> {
  const prefs = await readAppPreferences();
  if (!prefs.aiAutoTagEnabled || !prefs.aiAutoTagOnImport) return null;
  if (!(await isModelInstalled(app.getPath('userData'), 'heavy'))) return null;

  const result = await suggestTagsForCard(cardId);
  if (!result.ok) return { added: 0, created: 0 };
  if (result.tagIds.length === 0) return { added: 0, created: result.createdCount };

  const root = await readLibraryRootFromDisk();
  if (!root) return null;
  const row = getCardByIdFromDb(root, cardId);
  if (!row) return null;

  const before = new Set(row.tagIds);
  const merged = [...new Set([...row.tagIds, ...result.tagIds])];
  const added = merged.filter((id) => !before.has(id)).length;
  if (added > 0) {
    await updateCardInStorage(root, cardId, { tagIds: merged });
  }
  return { added, created: result.createdCount };
}

/**
 * Видео не проходит heavy-индексацию — автотег после импорта отдельным проходом.
 */
export async function applyAutoTagsForImportedVideos(
  cardIds: string[]
): Promise<{ cards: number; tags: number; created: number }> {
  const prefs = await readAppPreferences();
  const empty = { cards: 0, tags: 0, created: 0 };
  if (!prefs.aiAutoTagEnabled || !prefs.aiAutoTagOnImport) return empty;
  if (!(await isModelInstalled(app.getPath('userData'), 'heavy'))) return empty;

  const root = await readLibraryRootFromDisk();
  if (!root) return empty;

  let cards = 0;
  let tags = 0;
  let created = 0;

  for (const cardId of [...new Set(cardIds.filter(Boolean))]) {
    const row = getCardByIdFromDb(root, cardId);
    if (!row || row.type !== 'video') continue;
    try {
      const auto = await applyAutoTagsAfterIndex(cardId);
      if (auto && (auto.added > 0 || auto.created > 0)) {
        if (auto.added > 0) cards += 1;
        tags += auto.added;
        created += auto.created;
      }
    } catch {
      /* не блокируем импорт */
    }
  }

  return { cards, tags, created };
}

export function broadcastAutoTagApplied(payload: { cards: number; tags: number; created: number }): void {
  if (payload.cards <= 0 && payload.tags <= 0) return;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:auto-tag-applied', payload);
    }
  }
}

/** Сброс кэша эмбеддингов текстов меток (после изменений каталога). */
export function clearAutoTagNameEmbedCache(): void {
  textEmbedCache.clear();
}
