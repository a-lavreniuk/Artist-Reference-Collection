import type { CardIndexRow } from '../storage/types';

export type McpCardSummary = {
  id: string;
  type: string;
  name?: string;
  description?: string;
  linkUrl?: string;
  addedAt: string;
  dateModified?: string;
  tagIds: string[];
  collectionIds: string[];
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
  aiCaption?: string;
};

export function serializeCardRow(row: CardIndexRow): McpCardSummary {
  return {
    id: row.id,
    type: row.type,
    ...(row.name ? { name: row.name } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.linkUrl ? { linkUrl: row.linkUrl } : {}),
    addedAt: row.addedAt,
    ...(row.dateModified ? { dateModified: row.dateModified } : {}),
    tagIds: [...row.tagIds],
    collectionIds: [...row.collectionIds],
    ...(row.width != null ? { width: row.width } : {}),
    ...(row.height != null ? { height: row.height } : {}),
    ...(row.fileSize != null ? { fileSize: row.fileSize } : {}),
    ...(row.format ? { format: row.format } : {}),
    ...(row.aiCaption ? { aiCaption: row.aiCaption } : {})
  };
}
