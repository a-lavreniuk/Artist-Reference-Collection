export const TAG_DRAG_ID_MIME = 'application/tag-id';
export const TAG_DRAG_IDS_MIME = 'application/tag-ids';

export function isTagDragEvent(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(TAG_DRAG_ID_MIME);
}

export function writeTagDragPayload(dataTransfer: DataTransfer, tagIds: ReadonlySet<string>): void {
  const ids = [...tagIds];
  const anchorId = ids[0] ?? '';
  if (anchorId) {
    dataTransfer.setData(TAG_DRAG_ID_MIME, anchorId);
    dataTransfer.setData('text/plain', anchorId);
  }
  if (ids.length > 0) {
    dataTransfer.setData(TAG_DRAG_IDS_MIME, ids.join(','));
  }
}

export function readTagDragIds(
  dataTransfer: DataTransfer,
  fallback: ReadonlySet<string> | null
): string[] {
  const bulk = dataTransfer.getData(TAG_DRAG_IDS_MIME);
  if (bulk) {
    const ids = bulk
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length > 0) return ids;
  }

  const single =
    dataTransfer.getData(TAG_DRAG_ID_MIME) || dataTransfer.getData('text/plain');
  if (single) {
    if (fallback?.has(single)) return [...fallback];
    return [single];
  }

  return fallback ? [...fallback] : [];
}
