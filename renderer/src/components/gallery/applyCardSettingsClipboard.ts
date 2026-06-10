import type { CardRecord } from '../../services/db';
import type { CardSettingsClipboard } from './cardSettingsClipboard';

export type CardSettingsApplyPatch = {
  name?: string;
  linkUrl?: string;
  description?: string;
  tagIds?: string[];
  collectionIds?: string[];
};

export function buildCardSettingsApplyPatch(
  clipboard: CardSettingsClipboard,
  options: {
    validTagIds: Set<string>;
    validCollectionIds: Set<string>;
  }
): CardSettingsApplyPatch {
  const patch: CardSettingsApplyPatch = {};
  const { fields, values } = clipboard;

  if (fields.name) {
    patch.name = values.name ?? '';
  }
  if (fields.link) {
    patch.linkUrl = values.linkUrl ?? '';
  }
  if (fields.description) {
    patch.description = values.description ?? '';
  }
  if (fields.tags) {
    patch.tagIds = (values.tagIds ?? []).filter((id) => options.validTagIds.has(id));
  }
  if (fields.collections) {
    patch.collectionIds = (values.collectionIds ?? []).filter((id) => options.validCollectionIds.has(id));
  }

  return patch;
}

export function syncCardDetailDraftsFromPatch(
  patch: CardSettingsApplyPatch,
  setters: {
    setDraftName: (value: string) => void;
    setDraftLink: (value: string) => void;
    setDescription: (value: string) => void;
  }
): void {
  if (patch.name !== undefined) setters.setDraftName(patch.name);
  if (patch.linkUrl !== undefined) setters.setDraftLink(patch.linkUrl);
  if (patch.description !== undefined) setters.setDescription(patch.description);
}

export function buildCardSettingsSnapshot(
  fields: CardSettingsClipboard['fields'],
  source: {
    draftName: string;
    draftLink: string;
    description: string;
    card: CardRecord;
  }
): CardSettingsClipboard['values'] {
  const values: CardSettingsClipboard['values'] = {};

  if (fields.name) values.name = source.draftName;
  if (fields.link) values.linkUrl = source.draftLink;
  if (fields.description) values.description = source.description;
  if (fields.tags) values.tagIds = [...source.card.tagIds];
  if (fields.collections) values.collectionIds = [...source.card.collectionIds];

  return values;
}
