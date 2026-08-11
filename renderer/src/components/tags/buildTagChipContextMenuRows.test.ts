import { describe, expect, it, vi } from 'vitest';
import { buildTagChipContextMenuRows } from './buildTagChipContextMenuRows';

function labels(rows: ReturnType<typeof buildTagChipContextMenuRows>): string[] {
  return rows
    .filter((row): row is Extract<typeof row, { type: 'item' }> => row.type === 'item')
    .map((row) => row.label);
}

describe('buildTagChipContextMenuRows', () => {
  it('offers merge only for a multi-tag selection', () => {
    expect(
      labels(
        buildTagChipContextMenuRows({
          bulk: true,
          onMoveToCategory: vi.fn(),
          onMerge: vi.fn()
        })
      )
    ).toEqual(['Переместить в категорию…', 'Объединить метки…']);

    expect(
      labels(
        buildTagChipContextMenuRows({
          bulk: false,
          onMoveToCategory: vi.fn(),
          onMerge: vi.fn()
        })
      )
    ).not.toContain('Объединить метки…');
  });

  it('переключает подписи на множественные при мульти-выделении', () => {
    expect(
      labels(
        buildTagChipContextMenuRows({
          bulk: true,
          onShowInGallery: vi.fn(),
          onMoveToCategory: vi.fn(),
          onMerge: vi.fn(),
          onDelete: vi.fn()
        })
      )
    ).toEqual([
      'Показать карточки по меткам',
      'Переместить в категорию…',
      'Объединить метки…',
      'Удалить метки'
    ]);
  });

  it('прячет редактирование при мульти-выделении, но оставляет удаление', () => {
    const rows = labels(
      buildTagChipContextMenuRows({
        bulk: true,
        onMoveToCategory: vi.fn(),
        onDelete: vi.fn()
      })
    );
    expect(rows).not.toContain('Редактировать');
    expect(rows).toContain('Удалить метки');
  });

  it('предлагает «Выбрать несколько» только для одиночной метки', () => {
    const single = buildTagChipContextMenuRows({
      onStartMultiSelect: vi.fn(),
      onShowInGallery: vi.fn(),
      onMoveToCategory: vi.fn()
    });
    expect(labels(single)[0]).toBe('Выбрать несколько');
    expect(single[1]).toEqual({ type: 'separator', key: 'sep-multi' });

    expect(
      labels(
        buildTagChipContextMenuRows({
          bulk: true,
          onStartMultiSelect: vi.fn(),
          onMoveToCategory: vi.fn()
        })
      )
    ).not.toContain('Выбрать несколько');
  });

  it('keeps single-tag actions unchanged', () => {
    expect(
      labels(
        buildTagChipContextMenuRows({
          onShowInGallery: vi.fn(),
          onMoveToCategory: vi.fn(),
          onEdit: vi.fn(),
          onDelete: vi.fn()
        })
      )
    ).toEqual([
      'Показать в галерее',
      'Переместить в категорию…',
      'Редактировать',
      'Удалить метку'
    ]);
  });
});
