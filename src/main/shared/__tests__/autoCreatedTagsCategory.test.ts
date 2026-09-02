import { describe, expect, it } from 'vitest';

import {
  AUTO_CREATED_CATEGORY_NAME,
  AUTO_CREATED_CATEGORY_LOCKED_ERROR,
  MANUAL_AUTO_CREATED_CATEGORY_ERROR,
  assertCanCreateCategoryName,
  assertCanMutateCategory,
  assertCanWriteTagToCategory,
  categoriesForManualTagTarget,
  firstManualTagCategoryId,
  isAutoCreatedCategoryName,
  shouldHideAutoCreatedCategory
} from '../autoCreatedTagsCategory';

const auto = { id: 'auto', name: AUTO_CREATED_CATEGORY_NAME };
const animals = { id: 'a', name: 'Животные' };

describe('autoCreatedTagsCategory', () => {
  it('matches reserved name case-insensitively', () => {
    expect(isAutoCreatedCategoryName(AUTO_CREATED_CATEGORY_NAME)).toBe(true);
    expect(isAutoCreatedCategoryName('  автоматически созданные метки  ')).toBe(true);
    expect(isAutoCreatedCategoryName('Животные')).toBe(false);
  });

  it('hides empty auto category and keeps filled', () => {
    expect(shouldHideAutoCreatedCategory(AUTO_CREATED_CATEGORY_NAME, 0)).toBe(true);
    expect(shouldHideAutoCreatedCategory(AUTO_CREATED_CATEGORY_NAME, 2)).toBe(false);
    expect(shouldHideAutoCreatedCategory('Животные', 0)).toBe(false);
  });

  it('excludes auto category from create targets but keeps it when editing in place', () => {
    expect(categoriesForManualTagTarget([auto, animals])).toEqual([animals]);
    expect(categoriesForManualTagTarget([auto, animals], 'auto')).toEqual([auto, animals]);
  });

  it('picks first writable category', () => {
    expect(firstManualTagCategoryId([auto, animals], 'auto')).toBe('a');
    expect(firstManualTagCategoryId([auto, animals], 'a')).toBe('a');
  });

  it('rejects manual create and inbound move, allows stay and autotag', () => {
    expect(() =>
      assertCanWriteTagToCategory({ categories: [auto], targetCategoryId: 'auto' })
    ).toThrow(MANUAL_AUTO_CREATED_CATEGORY_ERROR);

    expect(() =>
      assertCanWriteTagToCategory({
        categories: [auto, animals],
        targetCategoryId: 'auto',
        previousCategoryId: 'a'
      })
    ).toThrow(MANUAL_AUTO_CREATED_CATEGORY_ERROR);

    expect(() =>
      assertCanWriteTagToCategory({
        categories: [auto],
        targetCategoryId: 'auto',
        previousCategoryId: 'auto'
      })
    ).not.toThrow();

    expect(() =>
      assertCanWriteTagToCategory({
        categories: [auto],
        targetCategoryId: 'auto',
        allowAutoCreated: true
      })
    ).not.toThrow();
  });

  it('locks reserved category name and mutations', () => {
    expect(() => assertCanCreateCategoryName(AUTO_CREATED_CATEGORY_NAME)).toThrow(
      AUTO_CREATED_CATEGORY_LOCKED_ERROR
    );
    expect(() => assertCanCreateCategoryName(AUTO_CREATED_CATEGORY_NAME, true)).not.toThrow();
    expect(() => assertCanMutateCategory({ currentName: AUTO_CREATED_CATEGORY_NAME })).toThrow(
      AUTO_CREATED_CATEGORY_LOCKED_ERROR
    );
    expect(() =>
      assertCanMutateCategory({ currentName: 'Животные', nextName: AUTO_CREATED_CATEGORY_NAME })
    ).toThrow(AUTO_CREATED_CATEGORY_LOCKED_ERROR);
  });
});
