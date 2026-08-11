import { describe, expect, it } from 'vitest';
import {
  formatDeleteTagsTitle,
  formatSelectedTagsSubtitle,
  formatTagsDeletedToast,
  formatTagsMovedToast,
  pluralTags
} from './tagsSelectionCopy';

describe('pluralTags', () => {
  it('склоняет по русским правилам', () => {
    expect(pluralTags(1)).toBe('метка');
    expect(pluralTags(2)).toBe('метки');
    expect(pluralTags(4)).toBe('метки');
    expect(pluralTags(5)).toBe('меток');
    expect(pluralTags(21)).toBe('метка');
    expect(pluralTags(22)).toBe('метки');
  });

  it('обрабатывает исключения второго десятка', () => {
    expect(pluralTags(11)).toBe('меток');
    expect(pluralTags(12)).toBe('меток');
    expect(pluralTags(14)).toBe('меток');
    expect(pluralTags(111)).toBe('меток');
  });
});

describe('формулировки массовых действий', () => {
  it('заголовок удаления различает одну метку и несколько', () => {
    expect(formatDeleteTagsTitle(1)).toBe('Удалить метку?');
    expect(formatDeleteTagsTitle(3)).toBe('Удалить 3 метки?');
    expect(formatDeleteTagsTitle(7)).toBe('Удалить 7 меток?');
  });

  it('тост удаления сообщает количество', () => {
    expect(formatTagsDeletedToast(1)).toBe('Метка удалена');
    expect(formatTagsDeletedToast(4)).toBe('Удалено меток: 4');
  });

  it('тост переноса называет категорию', () => {
    expect(formatTagsMovedToast(1, 'Стиль')).toBe('Метка перенесена в «Стиль»');
    expect(formatTagsMovedToast(5, 'Стиль')).toBe('Перенесено меток: 5 → «Стиль»');
  });

  it('тост переноса обходится без названия категории', () => {
    expect(formatTagsMovedToast(1)).toBe('Метка перенесена');
    expect(formatTagsMovedToast(3)).toBe('Перенесено меток: 3');
  });

  it('подзаголовок модалки переноса согласован по числу', () => {
    expect(formatSelectedTagsSubtitle(1)).toBe('Выбрана 1 метка');
    expect(formatSelectedTagsSubtitle(3)).toBe('Выбрано 3 метки');
    expect(formatSelectedTagsSubtitle(11)).toBe('Выбрано 11 меток');
  });
});
