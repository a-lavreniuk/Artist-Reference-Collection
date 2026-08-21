import type { CardAnnotationV1, CustomFieldsMap } from '@arc-main-shared/detailCardTemplate';

export const CARD_DETAIL_EDIT_HISTORY_MAX = 40;

export type CardDetailEditPatch = {
  name?: string;
  linkUrl?: string;
  description?: string;
  rating?: number;
  customFields?: CustomFieldsMap;
  annotations?: CardAnnotationV1[];
};

export type CardDetailCommitted = {
  name: string;
  linkUrl: string;
  description: string;
  rating: number;
  customFields: CustomFieldsMap;
  annotations: CardAnnotationV1[];
};

export type CardDetailEditEntry = {
  cardId: string;
  before: CardDetailEditPatch;
  after: CardDetailEditPatch;
};

export const EMPTY_CARD_DETAIL_COMMITTED: CardDetailCommitted = {
  name: '',
  linkUrl: '',
  description: '',
  rating: 0,
  customFields: {},
  annotations: []
};

export function cloneCustomFields(map: CustomFieldsMap): CustomFieldsMap {
  const next: CustomFieldsMap = {};
  for (const [key, value] of Object.entries(map)) {
    next[key] = Array.isArray(value) ? [...value] : value;
  }
  return next;
}

export function cloneAnnotations(list: CardAnnotationV1[]): CardAnnotationV1[] {
  return list.map((item) => ({ ...item }));
}

export function cloneCommitted(value: CardDetailCommitted): CardDetailCommitted {
  return {
    name: value.name,
    linkUrl: value.linkUrl,
    description: value.description,
    rating: value.rating,
    customFields: cloneCustomFields(value.customFields),
    annotations: cloneAnnotations(value.annotations)
  };
}

function clonePatch(patch: CardDetailEditPatch): CardDetailEditPatch {
  const next: CardDetailEditPatch = { ...patch };
  if (patch.customFields) next.customFields = cloneCustomFields(patch.customFields);
  if (patch.annotations) next.annotations = cloneAnnotations(patch.annotations);
  return next;
}

function patchFingerprint(patch: CardDetailEditPatch): string {
  return JSON.stringify({
    name: patch.name,
    linkUrl: patch.linkUrl,
    description: patch.description,
    rating: patch.rating,
    customFields: patch.customFields,
    annotations: patch.annotations
  });
}

export function patchesEqual(a: CardDetailEditPatch, b: CardDetailEditPatch): boolean {
  return patchFingerprint(a) === patchFingerprint(b);
}

export function diffAgainstCommitted(
  committed: CardDetailCommitted,
  next: CardDetailEditPatch
): { before: CardDetailEditPatch; after: CardDetailEditPatch } | null {
  const before: CardDetailEditPatch = {};
  const after: CardDetailEditPatch = {};

  if (next.name !== undefined && next.name !== committed.name) {
    before.name = committed.name;
    after.name = next.name;
  }
  if (next.linkUrl !== undefined && next.linkUrl !== committed.linkUrl) {
    before.linkUrl = committed.linkUrl;
    after.linkUrl = next.linkUrl;
  }
  if (next.description !== undefined && next.description !== committed.description) {
    before.description = committed.description;
    after.description = next.description;
  }
  if (next.rating !== undefined && next.rating !== committed.rating) {
    before.rating = committed.rating;
    after.rating = next.rating;
  }
  if (next.customFields !== undefined) {
    const current = { customFields: committed.customFields };
    const incoming = { customFields: next.customFields };
    if (!patchesEqual(current, incoming)) {
      before.customFields = cloneCustomFields(committed.customFields);
      after.customFields = cloneCustomFields(next.customFields);
    }
  }
  if (next.annotations !== undefined) {
    const current = { annotations: committed.annotations };
    const incoming = { annotations: next.annotations };
    if (!patchesEqual(current, incoming)) {
      before.annotations = cloneAnnotations(committed.annotations);
      after.annotations = cloneAnnotations(next.annotations);
    }
  }

  if (Object.keys(after).length === 0) return null;
  return { before, after };
}

export function applyPatchToCommitted(
  committed: CardDetailCommitted,
  patch: CardDetailEditPatch
): CardDetailCommitted {
  return {
    name: patch.name ?? committed.name,
    linkUrl: patch.linkUrl ?? committed.linkUrl,
    description: patch.description ?? committed.description,
    rating: patch.rating ?? committed.rating,
    customFields: patch.customFields
      ? cloneCustomFields(patch.customFields)
      : cloneCustomFields(committed.customFields),
    annotations: patch.annotations
      ? cloneAnnotations(patch.annotations)
      : cloneAnnotations(committed.annotations)
  };
}

export function createCardDetailEditHistory(maxEntries = CARD_DETAIL_EDIT_HISTORY_MAX) {
  let undoStack: CardDetailEditEntry[] = [];
  let redoStack: CardDetailEditEntry[] = [];

  return {
    push(entry: CardDetailEditEntry) {
      if (!entry.cardId || patchesEqual(entry.before, entry.after)) return;
      undoStack = [
        ...undoStack,
        {
          cardId: entry.cardId,
          before: clonePatch(entry.before),
          after: clonePatch(entry.after)
        }
      ];
      if (undoStack.length > maxEntries) undoStack = undoStack.slice(-maxEntries);
      redoStack = [];
    },
    undo(): CardDetailEditEntry | null {
      if (undoStack.length === 0) return null;
      const entry = undoStack[undoStack.length - 1]!;
      undoStack = undoStack.slice(0, -1);
      redoStack = [...redoStack, entry];
      return entry;
    },
    redo(): CardDetailEditEntry | null {
      if (redoStack.length === 0) return null;
      const entry = redoStack[redoStack.length - 1]!;
      redoStack = redoStack.slice(0, -1);
      undoStack = [...undoStack, entry];
      return entry;
    },
    clear() {
      undoStack = [];
      redoStack = [];
    }
  };
}

export type CardDetailEditHistory = ReturnType<typeof createCardDetailEditHistory>;
