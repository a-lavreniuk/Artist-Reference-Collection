import type { CardRecord } from '../arcSchema';
import * as storage from '../storageClient';
import type { StorageListCardsParams } from '../storageClient';

/** Размер страницы при обходе всей библиотеки — без одного гигантского IPC-вызова. */
export const LIST_CARDS_PAGE_SIZE = 500;

type ListAllParams = Omit<StorageListCardsParams, 'offset' | 'limit'>;

export async function listAllCardsPaginated(params: ListAllParams = {}): Promise<CardRecord[]> {
  const all: CardRecord[] = [];
  let offset = 0;
  for (;;) {
    const chunk = await storage.storageListCards({
      ...params,
      offset,
      limit: LIST_CARDS_PAGE_SIZE
    });
    all.push(...chunk);
    if (chunk.length < LIST_CARDS_PAGE_SIZE) break;
    offset += chunk.length;
  }
  return all;
}
