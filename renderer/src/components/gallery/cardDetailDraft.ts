const STORAGE_KEY = 'arc-card-detail-draft-v1';

type DraftStore = Record<string, { name?: string; linkUrl?: string }>;

function readStore(): DraftStore {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DraftStore;
  } catch {
    return {};
  }
}

function writeStore(store: DraftStore): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export type CardDetailDraft = {
  name: string;
  linkUrl: string;
};

export function readCardDetailDraft(cardId: string): CardDetailDraft {
  const entry = readStore()[cardId];
  return {
    name: entry?.name ?? '',
    linkUrl: entry?.linkUrl ?? ''
  };
}

export function patchCardDetailDraft(cardId: string, patch: Partial<CardDetailDraft>): void {
  const store = readStore();
  const prev = store[cardId] ?? {};
  store[cardId] = {
    ...prev,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.linkUrl !== undefined ? { linkUrl: patch.linkUrl } : {})
  };
  writeStore(store);
}

export function clearCardDetailDraft(cardId: string): void {
  const store = readStore();
  delete store[cardId];
  writeStore(store);
}
