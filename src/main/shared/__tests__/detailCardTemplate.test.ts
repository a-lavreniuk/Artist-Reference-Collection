import { describe, expect, it } from 'vitest';
import {
  createCustomTemplateField,
  createStarterTemplateField,
  customFieldsMapToSearchText,
  defaultDetailCardTemplate,
  fieldEditorNameDraft,
  fieldLabelFromEditorDraft,
  isFieldInMainList,
  mergeSubsequenceOrder,
  missingBuiltinFieldIds,
  omitCustomFieldKey,
  reorderVisibleTemplateFields,
  sanitizeCardAnnotations,
  sanitizeCustomFieldsMap,
  sanitizeDetailCardTemplate,
  annotationsToSearchText,
  isAnnotationVisibleAtTime,
  isPointAnnotation,
  serializeAnnotations,
  templateFieldIconClass,
  templateFieldLabel,
  VIDEO_ANNOTATION_TIME_EPS_MS
} from '../detailCardTemplate';

describe('sanitizeDetailCardTemplate', () => {
  it('keeps custom-only templates without restoring builtins', () => {
    const sanitized = sanitizeDetailCardTemplate({
      version: 1,
      fields: [{ id: 'abc', kind: 'custom', type: 'shortText', label: 'Клиент', visible: true }]
    });
    expect(sanitized.fields.map((f) => f.id)).toEqual(['abc']);
    const renamed = sanitizeDetailCardTemplate({
      version: 1,
      fields: sanitized.fields.map((f) => (f.id === 'abc' ? { ...f, label: 'Проект' } : f))
    });
    const custom = renamed.fields.find((f) => f.id === 'abc');
    expect(custom?.label).toBe('Проект');
    expect(custom?.showInFilters).toBe(true);
    expect(custom?.visibility).toBe('always');
  });

  it('keeps an empty fields list', () => {
    expect(sanitizeDetailCardTemplate({ version: 1, fields: [] }).fields).toEqual([]);
  });

  it('falls back to default when fields is missing', () => {
    expect(sanitizeDetailCardTemplate({ version: 1 }).fields.map((f) => f.id)).toEqual([
      'name',
      'link',
      'description'
    ]);
  });

  it('keeps starter label override and maps visible:false to alwaysHidden', () => {
    const sanitized = sanitizeDetailCardTemplate({
      version: 1,
      fields: [{ id: 'name', kind: 'builtin', visible: true, label: 'Название' }]
    });
    expect(templateFieldLabel(sanitized.fields[0]!)).toBe('Название');
    expect(sanitized.fields[0]?.type).toBe('shortText');
  });

  it('drops unknown types and duplicate ids', () => {
    const sanitized = sanitizeDetailCardTemplate({
      fields: [
        { id: 'name', kind: 'builtin', visible: false },
        { id: 'name', kind: 'builtin', visible: true },
        { id: 'x', kind: 'custom', type: 'year', label: 'Год' },
        { id: 'ok', kind: 'custom', type: 'date', label: '  Дата съёмки  ', visible: false }
      ]
    });
    expect(sanitized.fields.filter((f) => f.id === 'name')).toHaveLength(1);
    expect(sanitized.fields.find((f) => f.id === 'name')?.visibility).toBe('alwaysHidden');
    expect(sanitized.fields.some((f) => f.id === 'x')).toBe(false);
    const date = sanitized.fields.find((f) => f.id === 'ok');
    expect(date?.label).toBe('Дата съёмки');
    expect(date?.visibility).toBe('alwaysHidden');
  });
});

describe('template helpers', () => {
  it('lists missing builtins and icons', () => {
    const template = sanitizeDetailCardTemplate({
      version: 1,
      fields: [{ id: 'name', kind: 'builtin', visible: true }]
    });
    expect(missingBuiltinFieldIds(template)).toEqual(['link', 'description']);
    expect(templateFieldIconClass(template.fields[0]!)).toBe('arc-icon-text-short');
    expect(templateFieldIconClass(createCustomTemplateField('multiSelect', 'tags'))).toBe(
      'arc-icon-list-check'
    );
  });

  it('reorders only visible fields', () => {
    const fields = sanitizeDetailCardTemplate({
      version: 1,
      fields: [
        { id: 'name', kind: 'builtin', visible: true },
        { id: 'link', kind: 'builtin', visible: false },
        { id: 'description', kind: 'builtin', visible: true }
      ]
    }).fields;
    const next = reorderVisibleTemplateFields(fields, 'description', 0);
    expect(next.map((f) => f.id)).toEqual(['description', 'link', 'name']);
  });

  it('merges subsequence order without moving hidden slots', () => {
    const fields = defaultDetailCardTemplate().fields;
    const next = mergeSubsequenceOrder(fields, ['description', 'name']);
    expect(next.map((f) => f.id)).toEqual(['description', 'link', 'name']);
  });

  it('hides alwaysHidden and empty hiddenIfEmpty from the main list', () => {
    const hidden = createCustomTemplateField('shortText', 'a');
    hidden.visibility = 'alwaysHidden';
    const empty = createCustomTemplateField('shortText', 'b');
    empty.visibility = 'hiddenIfEmpty';
    expect(isFieldInMainList(hidden, true)).toBe(false);
    expect(isFieldInMainList(empty, false)).toBe(false);
    expect(isFieldInMainList(empty, true)).toBe(true);
  });
});

describe('custom field values and annotations', () => {
  it('omitting a key does not drop other values', () => {
    const next = omitCustomFieldKey({ a: '1', b: '2' }, 'a');
    expect(next).toEqual({ b: '2' });
  });

  it('keeps string and string[] values', () => {
    expect(sanitizeCustomFieldsMap({ a: 'x', b: ['one', 2, 'two'], c: 3 })).toEqual({
      a: 'x',
      b: ['one', 'two']
    });
  });

  it('flattens custom fields for search', () => {
    expect(customFieldsMapToSearchText({ a: 'Клиент', b: ['план', 'ветка'], c: '  ' })).toBe(
      'Клиент\nплан\nветка'
    );
  });

  it('builds search text and time visibility', () => {
    const list = sanitizeCardAnnotations([
      { id: '1', x: 0.1, y: 0.1, w: 0.2, h: 0.2, text: 'CTA', createdAt: '2026-01-01T00:00:00.000Z', timeMs: 1000 },
      { id: '2', x: 0.5, y: 0.4, w: 0, h: 0, text: 'point', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: '', x: 0, y: 0, w: 0.1, h: 0.1, text: 'skip' }
    ]);
    expect(list).toHaveLength(2);
    expect(isPointAnnotation(list[1]!)).toBe(true);
    expect(annotationsToSearchText(list)).toBe('CTA\npoint');
    expect(isAnnotationVisibleAtTime(list[0]!, 1000 + VIDEO_ANNOTATION_TIME_EPS_MS)).toBe(true);
    expect(isAnnotationVisibleAtTime(list[0]!, 1000 + VIDEO_ANNOTATION_TIME_EPS_MS + 1)).toBe(false);
    const packed = serializeAnnotations(list);
    expect(packed.json).toContain('CTA');
    expect(packed.text).toBe('CTA\npoint');
  });
});

describe('createCustomTemplateField', () => {
  it('uses type label and empty select options', () => {
    const field = createCustomTemplateField('select', 'id-1');
    expect(field.label).toBe('Выбор');
    expect(field.options).toEqual([]);
  });

  it('default template still has starter fields', () => {
    expect(defaultDetailCardTemplate().fields.map((f) => f.id)).toEqual(['name', 'link', 'description']);
  });
});

describe('fieldEditorNameDraft', () => {
  it('keeps starter names as values and type names as placeholders', () => {
    expect(fieldEditorNameDraft(createStarterTemplateField('name'))).toBe('Имя');
    expect(fieldEditorNameDraft(createStarterTemplateField('description'))).toBe('Описание');
    expect(fieldEditorNameDraft(createStarterTemplateField('link'))).toBe('Ссылка');
    expect(fieldEditorNameDraft(createCustomTemplateField('shortText', 'x'))).toBe('');
    expect(fieldLabelFromEditorDraft('', 'shortText')).toBe('Короткий текст');
    expect(fieldLabelFromEditorDraft('  Клиент  ', 'shortText')).toBe('Клиент');
  });

  it('hides a starter name that was cleared back to the type label', () => {
    const cleared = { ...createStarterTemplateField('name'), label: 'Короткий текст' };
    expect(fieldEditorNameDraft(cleared)).toBe('');
  });
});
