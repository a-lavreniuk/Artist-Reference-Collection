export type CardSettingsField = 'name' | 'link' | 'description' | 'tags' | 'collections';

export const CARD_SETTINGS_FIELDS: CardSettingsField[] = [
  'name',
  'link',
  'description',
  'tags',
  'collections'
];

export const CARD_SETTINGS_FIELD_LABELS: Record<CardSettingsField, string> = {
  name: 'Имя',
  link: 'Ссылка',
  description: 'Описание',
  tags: 'Метки',
  collections: 'Коллекции'
};

export type CardSettingsFieldSelection = Record<CardSettingsField, boolean>;

export type CardSettingsClipboard = {
  fields: CardSettingsFieldSelection;
  values: {
    name?: string;
    linkUrl?: string;
    description?: string;
    tagIds?: string[];
    collectionIds?: string[];
  };
};

export function createDefaultFieldSelection(): CardSettingsFieldSelection {
  return {
    name: true,
    link: true,
    description: true,
    tags: true,
    collections: true
  };
}

let clipboard: CardSettingsClipboard | null = null;
let lastFieldSelection: CardSettingsFieldSelection = createDefaultFieldSelection();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getCardSettingsClipboard(): CardSettingsClipboard | null {
  return clipboard;
}

export function getLastCardSettingsFieldSelection(): CardSettingsFieldSelection {
  return { ...lastFieldSelection };
}

export function setCardSettingsClipboard(next: CardSettingsClipboard): void {
  clipboard = {
    fields: { ...next.fields },
    values: {
      ...next.values,
      ...(next.values.tagIds !== undefined ? { tagIds: [...next.values.tagIds] } : {}),
      ...(next.values.collectionIds !== undefined ? { collectionIds: [...next.values.collectionIds] } : {})
    }
  };
  lastFieldSelection = { ...next.fields };
  emit();
}

export function rememberCardSettingsFieldSelection(selection: CardSettingsFieldSelection): void {
  lastFieldSelection = { ...selection };
}

export function subscribeCardSettingsClipboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasSelectedCardSettingsField(selection: CardSettingsFieldSelection): boolean {
  return CARD_SETTINGS_FIELDS.some((field) => selection[field]);
}
