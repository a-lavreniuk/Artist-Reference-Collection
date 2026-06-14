import type { ModelTier } from './types';

export type SearchCutoff = {
  minScore: number;
  topK: number;
  relativeThreshold: number;
  allowFallback: boolean;
  fallbackCount: number;
};

type CutoffEndpoint = Omit<SearchCutoff, 'allowFallback' | 'fallbackCount'> & {
  allowFallback?: boolean;
  fallbackCount?: number;
};

const ENDPOINTS: Record<ModelTier, { loose: CutoffEndpoint; base: CutoffEndpoint; strict: CutoffEndpoint }> = {
  light: {
    loose: { minScore: 0.1, topK: 120, relativeThreshold: 0.55, allowFallback: true, fallbackCount: 16 },
    base: { minScore: 0.22, topK: 48, relativeThreshold: 0.72 },
    strict: { minScore: 0.32, topK: 20, relativeThreshold: 0.9 }
  },
  heavy: {
    loose: { minScore: 0.12, topK: 96, relativeThreshold: 0.58, allowFallback: true, fallbackCount: 14 },
    base: { minScore: 0.24, topK: 40, relativeThreshold: 0.74 },
    strict: { minScore: 0.36, topK: 18, relativeThreshold: 0.88 }
  }
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpEndpoint(a: CutoffEndpoint, b: CutoffEndpoint, t: number): CutoffEndpoint {
  return {
    minScore: lerp(a.minScore, b.minScore, t),
    topK: Math.round(lerp(a.topK, b.topK, t)),
    relativeThreshold: lerp(a.relativeThreshold, b.relativeThreshold, t),
    allowFallback: t <= 0.5 ? a.allowFallback : b.allowFallback,
    fallbackCount: Math.round(lerp(a.fallbackCount ?? 0, b.fallbackCount ?? 0, t))
  };
}

function normalizeStrictness(raw: number | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 50;
  const stepped = Math.round(raw / 5) * 5;
  return Math.max(0, Math.min(100, stepped));
}

export function resolveSearchCutoff(tier: ModelTier, strictnessRaw?: number): SearchCutoff {
  const strictness = normalizeStrictness(strictnessRaw);
  const endpoints = ENDPOINTS[tier];

  let resolved: CutoffEndpoint;
  if (strictness <= 50) {
    resolved = lerpEndpoint(endpoints.loose, endpoints.base, strictness / 50);
  } else {
    resolved = lerpEndpoint(endpoints.base, endpoints.strict, (strictness - 50) / 50);
  }

  const allowFallback = strictness <= 20 && Boolean(resolved.allowFallback);
  return {
    minScore: resolved.minScore,
    topK: resolved.topK,
    relativeThreshold: resolved.relativeThreshold,
    allowFallback,
    fallbackCount: allowFallback ? resolved.fallbackCount ?? 16 : 0
  };
}

export function searchStrictnessHint(strictnessRaw?: number): string {
  const strictness = normalizeStrictness(strictnessRaw);
  if (strictness <= 20) {
    return 'Больше карточек, возможны слабо связанные изображения';
  }
  if (strictness <= 40) {
    return 'Расширенный поиск, небольшой шум в хвосте';
  }
  if (strictness <= 60) {
    return 'Рекомендуемый баланс точности и полноты';
  }
  if (strictness <= 80) {
    return 'Только близкие совпадения, список короче';
  }
  return 'Максимальная строгость, часто пустая выдача';
}
