import type { CollectionRecord } from '../../services/db';
import { collectionParentId } from '@arc-main-shared/collectionHierarchy';

export function collectionHref(item: Pick<CollectionRecord, 'id' | 'parentId'>): string {
  const parentId = collectionParentId(item);
  if (parentId) return `/collections/${parentId}/sections/${item.id}`;
  return `/collections/${item.id}`;
}
