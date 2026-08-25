/** Иерархия коллекций: один уровень вложенности (коллекция → разделы). */

export type CollectionHierarchyRef = {
  id: string;
  name?: string;
  parentId?: string | null;
  sortIndex?: number;
};

export function collectionParentId(node: CollectionHierarchyRef): string | null {
  const parentId = node.parentId?.trim();
  return parentId ? parentId : null;
}

export function isCollectionSection(node: CollectionHierarchyRef): boolean {
  return collectionParentId(node) != null;
}

export function assertCollectionParentIsRoot(
  collections: readonly CollectionHierarchyRef[],
  parentId: string
): CollectionHierarchyRef {
  const parent = collections.find((item) => item.id === parentId);
  if (!parent) {
    throw new Error('Родительская коллекция не найдена');
  }
  if (isCollectionSection(parent)) {
    throw new Error('Раздел нельзя вложить в раздел');
  }
  return parent;
}

export function siblingNameTaken(
  collections: readonly CollectionHierarchyRef[],
  name: string,
  parentId: string | null,
  exceptId?: string
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return collections.some((item) => {
    if (exceptId && item.id === exceptId) return false;
    if ((collectionParentId(item) ?? null) !== (parentId ?? null)) return false;
    return (item.name ?? '').trim().toLowerCase() === needle;
  });
}

export function uniqueSiblingName(
  collections: readonly CollectionHierarchyRef[],
  desired: string,
  parentId: string | null,
  exceptId?: string
): string {
  const base = desired.trim() || 'Без названия';
  if (!siblingNameTaken(collections, base, parentId, exceptId)) return base;
  let n = 2;
  while (siblingNameTaken(collections, `${base} ${n}`, parentId, exceptId)) n += 1;
  return `${base} ${n}`;
}

export function uniqueCopyName(
  collections: readonly CollectionHierarchyRef[],
  sourceName: string,
  parentId: string | null
): string {
  return uniqueSiblingName(collections, `Копия ${sourceName.trim() || 'Без названия'}`, parentId);
}

export function rootCollections<T extends CollectionHierarchyRef>(collections: readonly T[]): T[] {
  return collections
    .filter((item) => !isCollectionSection(item))
    .sort(compareCollectionOrder);
}

export function childSections<T extends CollectionHierarchyRef>(
  collections: readonly T[],
  parentId: string
): T[] {
  return collections
    .filter((item) => collectionParentId(item) === parentId)
    .sort(compareCollectionOrder);
}

export function compareCollectionOrder(a: CollectionHierarchyRef, b: CollectionHierarchyRef): number {
  const sortDiff = (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
  if (sortDiff !== 0) return sortDiff;
  return (a.name ?? '').localeCompare(b.name ?? '', 'ru');
}

/** Корни по sortIndex, сразу под каждым — его разделы. */
export function flattenCollectionTree<T extends CollectionHierarchyRef>(collections: readonly T[]): T[] {
  const out: T[] = [];
  for (const root of rootCollections(collections)) {
    out.push(root);
    out.push(...childSections(collections, root.id));
  }
  return out;
}

export type CollectionPickerTreeRow<T extends CollectionHierarchyRef> = {
  item: T;
  nested: boolean;
};

/** Коллекция, затем её разделы. Поиск сохраняет родителя, если совпал только раздел. */
export function filterCollectionPickerTree<T extends CollectionHierarchyRef>(
  collections: readonly T[],
  query = ''
): CollectionPickerTreeRow<T>[] {
  const q = query.trim().toLowerCase();
  const out: CollectionPickerTreeRow<T>[] = [];
  for (const root of rootCollections(collections)) {
    const children = childSections(collections, root.id);
    const rootMatch = !q || (root.name ?? '').toLowerCase().includes(q);
    const matchingChildren = q
      ? children.filter((child) => (child.name ?? '').toLowerCase().includes(q))
      : children;
    if (!rootMatch && matchingChildren.length === 0) continue;
    out.push({ item: root, nested: false });
    const visibleChildren = !q || rootMatch ? children : matchingChildren;
    for (const child of visibleChildren) {
      out.push({ item: child, nested: true });
    }
  }
  return out;
}

export function normalizeCardCollectionIds(
  ids: readonly string[],
  collections: readonly CollectionHierarchyRef[]
): string[] {
  const byId = new Map(collections.map((item) => [item.id, item]));
  const next = new Set<string>();
  for (const id of ids) {
    if (!byId.has(id)) continue;
    next.add(id);
  }
  for (const id of [...next]) {
    const parentId = collectionParentId(byId.get(id)!);
    if (parentId && byId.has(parentId)) next.add(parentId);
  }
  return [...next];
}

export function addCollectionToCardIds(
  ids: readonly string[],
  collectionId: string,
  collections: readonly CollectionHierarchyRef[]
): string[] {
  if (!collections.some((item) => item.id === collectionId)) return [...ids];
  return normalizeCardCollectionIds([...ids, collectionId], collections);
}

export function removeCollectionFromCardIds(
  ids: readonly string[],
  collectionId: string,
  collections: readonly CollectionHierarchyRef[]
): string[] {
  const byId = new Map(collections.map((item) => [item.id, item]));
  const node = byId.get(collectionId);
  if (!node) return ids.filter((id) => id !== collectionId);
  if (!isCollectionSection(node)) {
    const childIds = new Set(
      collections.filter((item) => collectionParentId(item) === collectionId).map((item) => item.id)
    );
    return ids.filter((id) => id !== collectionId && !childIds.has(id));
  }
  return ids.filter((id) => id !== collectionId);
}

export function toggleCollectionOnCardIds(
  ids: readonly string[],
  collectionId: string,
  collections: readonly CollectionHierarchyRef[]
): string[] {
  if (ids.includes(collectionId)) {
    return removeCollectionFromCardIds(ids, collectionId, collections);
  }
  return addCollectionToCardIds(ids, collectionId, collections);
}

export function descendantOrSelfIds(
  collections: readonly CollectionHierarchyRef[],
  collectionId: string
): string[] {
  const children = collections
    .filter((item) => collectionParentId(item) === collectionId)
    .map((item) => item.id);
  return [collectionId, ...children];
}

export function formatSectionCountLabel(count: number): string {
  const n10 = count % 10;
  const n100 = count % 100;
  if (n10 === 1 && n100 !== 11) return `${count} раздел`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${count} раздела`;
  return `${count} разделов`;
}

export function parseCollectionsPath(
  pathname: string
): { collectionId: string; sectionId?: string } | null {
  const sectionMatch = pathname.match(/^\/collections\/([^/?#]+)\/sections\/([^/?#]+)/);
  if (sectionMatch) {
    const collectionId = decodeURIComponent(sectionMatch[1] ?? '').trim();
    const sectionId = decodeURIComponent(sectionMatch[2] ?? '').trim();
    if (!collectionId || !sectionId) return null;
    return { collectionId, sectionId };
  }
  const collectionMatch = pathname.match(/^\/collections\/([^/?#]+)/);
  if (!collectionMatch) return null;
  const collectionId = decodeURIComponent(collectionMatch[1] ?? '').trim();
  return collectionId ? { collectionId } : null;
}
