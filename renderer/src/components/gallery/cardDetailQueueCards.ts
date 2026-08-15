import { listCardsPage, type CardRecord } from '../../services/db';

const CHUNK = 400;

export async function loadCardsInOrder(ids: readonly string[]): Promise<CardRecord[]> {
  if (ids.length === 0) return [];
  const byId = new Map<string, CardRecord>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = await listCardsPage({
      offset: 0,
      limit: chunk.length,
      libraryScope: 'all',
      selectedTagIds: [],
      moodboardCardIds: [...chunk]
    });
    for (const row of rows) byId.set(row.id, row);
  }
  const ordered: CardRecord[] = [];
  for (const id of ids) {
    const card = byId.get(id);
    if (card) ordered.push(card);
  }
  return ordered;
}
