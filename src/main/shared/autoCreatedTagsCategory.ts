export const AUTO_CREATED_CATEGORY_NAME = 'Автоматически созданные метки';

export const MANUAL_AUTO_CREATED_CATEGORY_ERROR = 'В эту категорию нельзя добавлять метки вручную';

export const AUTO_CREATED_CATEGORY_LOCKED_ERROR = 'Нельзя изменить эту категорию';

export function isAutoCreatedCategoryName(name: string): boolean {
  return name.trim().toLowerCase() === AUTO_CREATED_CATEGORY_NAME.toLowerCase();
}

export function categoriesForManualTagTarget<T extends { id: string; name: string }>(
  categories: readonly T[],
  keepCategoryId?: string | null
): T[] {
  return categories.filter((category) => {
    if (!isAutoCreatedCategoryName(category.name)) return true;
    return Boolean(keepCategoryId) && category.id === keepCategoryId;
  });
}

export function firstManualTagCategoryId<T extends { id: string; name: string }>(
  categories: readonly T[],
  preferredId?: string | null
): string | undefined {
  const writable = categoriesForManualTagTarget(categories);
  if (preferredId && writable.some((category) => category.id === preferredId)) {
    return preferredId;
  }
  return writable[0]?.id;
}

export function shouldHideAutoCreatedCategory(name: string, tagCount: number): boolean {
  return isAutoCreatedCategoryName(name) && tagCount <= 0;
}

export function assertCanWriteTagToCategory(options: {
  categories: readonly { id: string; name: string }[];
  targetCategoryId: string;
  previousCategoryId?: string | null;
  allowAutoCreated?: boolean;
}): void {
  if (options.allowAutoCreated) return;
  const target = options.categories.find((category) => category.id === options.targetCategoryId);
  if (!target || !isAutoCreatedCategoryName(target.name)) return;
  if (options.previousCategoryId && options.previousCategoryId === options.targetCategoryId) {
    return;
  }
  throw new Error(MANUAL_AUTO_CREATED_CATEGORY_ERROR);
}

export function assertCanCreateCategoryName(name: string, allowReservedName?: boolean): void {
  if (allowReservedName) return;
  if (isAutoCreatedCategoryName(name)) {
    throw new Error(AUTO_CREATED_CATEGORY_LOCKED_ERROR);
  }
}

export function assertCanMutateCategory(options: {
  currentName: string;
  nextName?: string;
}): void {
  if (isAutoCreatedCategoryName(options.currentName)) {
    throw new Error(AUTO_CREATED_CATEGORY_LOCKED_ERROR);
  }
  if (options.nextName !== undefined && isAutoCreatedCategoryName(options.nextName)) {
    throw new Error(AUTO_CREATED_CATEGORY_LOCKED_ERROR);
  }
}
