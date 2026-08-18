import { describe, expect, it } from 'vitest';
import {
  createCustomTemplateField,
  defaultDetailCardTemplate,
  omitCustomFieldKey,
  sanitizeCardAnnotations,
  sanitizeCustomFieldsMap,
  sanitizeDetailCardTemplate,
  annotationsToSearchText,
  isAnnotationVisibleAtTime,
  isPointAnnotation,
  serializeAnnotations,
  VIDEO_ANNOTATION_TIME_EPS_MS
} from '../detailCardTemplate';

describe('sanitizeDetailCardTemplate', () => {
  it('fills missing builtin fields and keeps custom id on rename', () => {
    const sanitized = sanitizeDetailCardTemplate({
      version: 1,
      fields: [{ id: 'abc', kind: 'custom', type: 'shortText', label: 'Клиент', visible: true }]
    });
    expect(sanitized.fields.map((f) => f.id)).toEqual(['abc', 'name', 'link', 'description']);
    const renamed = sanitizeDetailCardTemplate({
      version: 1,
      fields: sanitized.fields.map((f) =>
        f.kind === 'custom' && f.id === 'abc' ? { ...f, label: 'Проект' } : f
      )
    });
    const custom = renamed.fields.find((f) => f.kind === 'custom');
    expect(custom?.id).toBe('abc');
    expect(custom && custom.kind === 'custom' ? custom.label : null).toBe('Проект');
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
    expect(sanitized.fields.find((f) => f.id === 'name')?.visible).toBe(false);
    expect(sanitized.fields.some((f) => f.id === 'x')).toBe(false);
    const date = sanitized.fields.find((f) => f.id === 'ok');
    expect(date && date.kind === 'custom' ? date.label : null).toBe('Дата съёмки');
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
    expect(field.label).toBe('Селектор');
    expect(field.options).toEqual([]);
  });
});
