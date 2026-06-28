const CYRILLIC_RE = /[\u0400-\u04FF]/;
const CLIP_PROMPT_RE = /^a (photo|picture|image|photograph) of/i;

type TranslateFn = (text: string) => Promise<string>;

let translateRuEn: TranslateFn | null = null;
let translateLoading: Promise<TranslateFn | null> | null = null;

export function hasCyrillic(text: string): boolean {
  return CYRILLIC_RE.test(text);
}

async function loadRuEnTranslator(modelsDir: string): Promise<TranslateFn | null> {
  if (translateRuEn) return translateRuEn;
  if (translateLoading) return translateLoading;

  translateLoading = (async () => {
    const path = await import('path');
    const transformers = await import('@xenova/transformers');
    const { env, pipeline } = transformers;
    env.cacheDir = path.join(modelsDir, 'transformers');
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;

    try {
      const translator = await pipeline('translation', 'Xenova/opus-mt-ru-en', {
        quantized: true,
        local_files_only: true
      });
      translateRuEn = async (text: string) => {
        const out = await translator(text);
        const first = Array.isArray(out) ? out[0] : out;
        const translated =
          first && typeof first === 'object' && 'translation_text' in first
            ? String((first as { translation_text: string }).translation_text)
            : undefined;
        return typeof translated === 'string' && translated.trim() ? translated.trim() : text;
      };
      return translateRuEn;
    } catch {
      return null;
    }
  })();

  return translateLoading;
}

/** Без перевода и CLIP-шаблона — для Qwen3 / caption search. */
export function prepareSearchQueryRaw(raw: string): string {
  return raw.trim();
}

/** CLIP обучен на английских подписях — переводим кириллицу и добавляем prompt-шаблон. */
export async function prepareSearchQuery(raw: string, modelsDir: string): Promise<string> {
  let query = raw.trim();
  if (!query) return query;

  if (hasCyrillic(query)) {
    const translate = await loadRuEnTranslator(modelsDir);
    if (translate) {
      query = await translate(query);
    }
  }

  if (!CLIP_PROMPT_RE.test(query)) {
    query = `a photo of ${query}`;
  }

  return query;
}

export function resetQueryPrepCache(): void {
  translateRuEn = null;
  translateLoading = null;
}
