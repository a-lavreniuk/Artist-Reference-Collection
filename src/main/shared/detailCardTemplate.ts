/** Шаблон блока «Детали» и значения/аннотации карточки. */

export const DETAIL_BUILTIN_FIELD_IDS = ['name', 'link', 'description'] as const;
export type DetailBuiltinFieldId = (typeof DETAIL_BUILTIN_FIELD_IDS)[number];

export const CUSTOM_FIELD_TYPES = [
  'shortText',
  'longText',
  'select',
  'multiSelect',
  'date',
  'url'
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const FIELD_VISIBILITY_MODES = ['always', 'alwaysHidden', 'hiddenIfEmpty'] as const;
export type FieldVisibilityMode = (typeof FIELD_VISIBILITY_MODES)[number];

export const DETAIL_BUILTIN_FIELD_LABELS: Record<DetailBuiltinFieldId, string> = {
  name: 'Имя',
  link: 'Ссылка',
  description: 'Описание'
};

export const STARTER_FIELD_TYPES: Record<DetailBuiltinFieldId, CustomFieldType> = {
  name: 'shortText',
  link: 'url',
  description: 'longText'
};

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  shortText: 'Короткий текст',
  longText: 'Длинный текст',
  url: 'Ссылка',
  date: 'Дата',
  select: 'Выбор',
  multiSelect: 'Мульти-выбор'
};

export const FIELD_VISIBILITY_LABELS: Record<FieldVisibilityMode, string> = {
  always: 'Видно всегда',
  alwaysHidden: 'Всегда скрыто',
  hiddenIfEmpty: 'Скрыто если пусто'
};

export type DetailTemplateField = {
  id: string;
  type: CustomFieldType;
  label: string;
  visibility: FieldVisibilityMode;
  showInFilters: boolean;
  options?: string[];
};

/** @deprecated Старый формат; sanitize приводит к DetailTemplateField. */
export type DetailTemplateBuiltinField = DetailTemplateField & { kind?: 'builtin' };
/** @deprecated Старый формат; sanitize приводит к DetailTemplateField. */
export type DetailTemplateCustomField = DetailTemplateField & { kind?: 'custom' };

export type DetailCardTemplateV1 = {
  version: 1;
  fields: DetailTemplateField[];
};

export type CustomFieldValue = string | string[];
export type CustomFieldsMap = Record<string, CustomFieldValue>;

export type CardAnnotationV1 = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  createdAt: string;
  timeMs?: number;
};

/** Порог «рядом с кадром» для пинов на видео (мс). */
export const VIDEO_ANNOTATION_TIME_EPS_MS = 250;

const CUSTOM_TYPE_SET = new Set<string>(CUSTOM_FIELD_TYPES);
const STARTER_SET = new Set<string>(DETAIL_BUILTIN_FIELD_IDS);
const VISIBILITY_SET = new Set<string>(FIELD_VISIBILITY_MODES);

export function isStarterFieldId(id: string): id is DetailBuiltinFieldId {
  return STARTER_SET.has(id);
}

export function isSafeFieldId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export function defaultDetailCardTemplate(): DetailCardTemplateV1 {
  return {
    version: 1,
    fields: DETAIL_BUILTIN_FIELD_IDS.map((id) => createStarterTemplateField(id))
  };
}

function isCustomFieldType(value: unknown): value is CustomFieldType {
  return typeof value === 'string' && CUSTOM_TYPE_SET.has(value);
}

function sanitizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const label = item.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function sanitizeVisibility(raw: unknown, visibleFallback?: unknown): FieldVisibilityMode {
  if (typeof raw === 'string' && VISIBILITY_SET.has(raw)) return raw as FieldVisibilityMode;
  if (visibleFallback === false) return 'alwaysHidden';
  return 'always';
}

function starterTypeForId(id: string): CustomFieldType | null {
  if (id === 'name' || id === 'link' || id === 'description') return STARTER_FIELD_TYPES[id];
  return null;
}

function sanitizeTemplateField(raw: unknown): DetailTemplateField | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string' || !rec.id.trim()) return null;
  const id = rec.id.trim();
  if (!isSafeFieldId(id)) return null;

  let type: CustomFieldType | null = null;
  if (rec.kind === 'builtin' && isStarterFieldId(id)) {
    type = STARTER_FIELD_TYPES[id];
  } else if (isCustomFieldType(rec.type)) {
    type = rec.type;
  } else if (isStarterFieldId(id)) {
    type = STARTER_FIELD_TYPES[id];
  }
  if (!type) return null;

  const defaultLabel = isStarterFieldId(id) ? DETAIL_BUILTIN_FIELD_LABELS[id] : CUSTOM_FIELD_TYPE_LABELS[type];
  const label = typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : defaultLabel;
  const field: DetailTemplateField = {
    id,
    type,
    label,
    visibility: sanitizeVisibility(rec.visibility, rec.visible),
    showInFilters: rec.showInFilters !== false
  };
  if (type === 'select' || type === 'multiSelect') {
    field.options = sanitizeOptions(rec.options);
  }
  return field;
}

export function sanitizeDetailCardTemplate(raw: unknown): DetailCardTemplateV1 {
  const fallback = defaultDetailCardTemplate();
  if (!raw || typeof raw !== 'object') return fallback;
  const rec = raw as Record<string, unknown>;
  if (!Array.isArray(rec.fields)) return fallback;
  const fields: DetailTemplateField[] = [];
  const seen = new Set<string>();

  for (const item of rec.fields) {
    const field = sanitizeTemplateField(item);
    if (!field || seen.has(field.id)) continue;
    seen.add(field.id);
    fields.push(field);
  }

  return { version: 1, fields };
}

export function createCustomTemplateField(type: CustomFieldType, id: string): DetailTemplateField {
  const field: DetailTemplateField = {
    id,
    type,
    label: CUSTOM_FIELD_TYPE_LABELS[type],
    visibility: 'always',
    showInFilters: true
  };
  if (type === 'select' || type === 'multiSelect') field.options = [];
  return field;
}

export function createStarterTemplateField(id: DetailBuiltinFieldId): DetailTemplateField {
  return {
    id,
    type: STARTER_FIELD_TYPES[id],
    label: DETAIL_BUILTIN_FIELD_LABELS[id],
    visibility: 'always',
    showInFilters: true
  };
}

export function applyDetailFieldType(
  template: DetailCardTemplateV1,
  fieldId: string,
  type: CustomFieldType
): DetailCardTemplateV1 {
  return sanitizeDetailCardTemplate({
    version: 1,
    fields: template.fields.map((field) => {
      if (field.id !== fieldId) return field;
      const next: DetailTemplateField = { ...field, type };
      if (type === 'select' || type === 'multiSelect') {
        next.options = field.options ?? [];
      } else {
        delete next.options;
      }
      return next;
    })
  });
}

/** @deprecated Используйте createStarterTemplateField. */
export function createBuiltinTemplateField(id: DetailBuiltinFieldId): DetailTemplateField {
  return createStarterTemplateField(id);
}

export function missingBuiltinFieldIds(template: DetailCardTemplateV1): DetailBuiltinFieldId[] {
  const have = new Set(template.fields.map((field) => field.id));
  return DETAIL_BUILTIN_FIELD_IDS.filter((id) => !have.has(id));
}

export function templateFieldLabel(field: DetailTemplateField): string {
  const trimmed = field.label.trim();
  if (trimmed) return trimmed;
  if (isStarterFieldId(field.id)) return DETAIL_BUILTIN_FIELD_LABELS[field.id];
  return CUSTOM_FIELD_TYPE_LABELS[field.type];
}

/** Подпись в меню свойства. Стартовые Имя/Ссылка/Описание — value, не placeholder типа. */
export function fieldEditorNameDraft(field: DetailTemplateField): string {
  const current = templateFieldLabel(field).trim();
  const typeLabel = CUSTOM_FIELD_TYPE_LABELS[field.type];
  if (isStarterFieldId(field.id) && current === DETAIL_BUILTIN_FIELD_LABELS[field.id]) {
    return current;
  }
  return current === typeLabel ? '' : current;
}

export function fieldLabelFromEditorDraft(draft: string, type: CustomFieldType): string {
  return draft.trim() || CUSTOM_FIELD_TYPE_LABELS[type];
}

export function templateFieldTypeLabel(field: DetailTemplateField): string {
  return CUSTOM_FIELD_TYPE_LABELS[field.type];
}

/** Иконка типа свойства — `arc-icon-*` из UI-Kit. */
export function templateFieldIconClass(field: DetailTemplateField): string {
  if (field.type === 'shortText') return 'arc-icon-text-short';
  if (field.type === 'longText') return 'arc-icon-textarea';
  if (field.type === 'url') return 'arc-icon-link';
  if (field.type === 'date') return 'arc-icon-calendar';
  if (field.type === 'select') return 'arc-icon-check-circle';
  if (field.type === 'multiSelect') return 'arc-icon-list-check';
  return 'arc-icon-list';
}

export function customFieldTypeIconClass(type: CustomFieldType): string {
  return templateFieldIconClass({
    id: 'preview',
    type,
    label: CUSTOM_FIELD_TYPE_LABELS[type],
    visibility: 'always',
    showInFilters: true
  });
}

export function isFieldInMainList(field: DetailTemplateField, hasValue: boolean): boolean {
  if (field.visibility === 'always') return true;
  if (field.visibility === 'alwaysHidden') return false;
  return hasValue;
}

export function customFieldValueIsFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => typeof item === 'string' && item.trim().length > 0);
  return false;
}

export function starterTypeForFieldId(id: string): CustomFieldType | null {
  return starterTypeForId(id);
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function sanitizeCustomFieldsMap(raw: unknown): CustomFieldsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CustomFieldsMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (typeof value === 'string') {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.filter((item): item is string => typeof item === 'string');
    }
  }
  return out;
}

export function sanitizeCardAnnotation(raw: unknown): CardAnnotationV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string' || !rec.id.trim()) return null;
  if (typeof rec.text !== 'string') return null;
  const x = clampUnit(typeof rec.x === 'number' ? rec.x : Number(rec.x));
  const y = clampUnit(typeof rec.y === 'number' ? rec.y : Number(rec.y));
  const w = clampUnit(typeof rec.w === 'number' ? rec.w : Number(rec.w));
  const h = clampUnit(typeof rec.h === 'number' ? rec.h : Number(rec.h));
  const createdAt =
    typeof rec.createdAt === 'string' && rec.createdAt.trim() ? rec.createdAt : new Date().toISOString();
  const annot: CardAnnotationV1 = {
    id: rec.id.trim(),
    x,
    y,
    w,
    h,
    text: rec.text,
    createdAt
  };
  if (typeof rec.timeMs === 'number' && Number.isFinite(rec.timeMs) && rec.timeMs >= 0) {
    annot.timeMs = Math.round(rec.timeMs);
  }
  return annot;
}

export function sanitizeCardAnnotations(raw: unknown): CardAnnotationV1[] {
  if (!Array.isArray(raw)) return [];
  const out: CardAnnotationV1[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const annot = sanitizeCardAnnotation(item);
    if (!annot || seen.has(annot.id)) continue;
    seen.add(annot.id);
    out.push(annot);
  }
  return out;
}

export function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

export function annotationsToSearchText(annotations: CardAnnotationV1[]): string {
  return annotations
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n');
}

export function isAnnotationVisibleAtTime(annot: CardAnnotationV1, currentMs: number | null): boolean {
  if (annot.timeMs == null || currentMs == null) return annot.timeMs == null;
  return Math.abs(annot.timeMs - currentMs) <= VIDEO_ANNOTATION_TIME_EPS_MS;
}

/** Точечная метка: клик без рамки (w и h равны нулю). */
export function isPointAnnotation(annot: Pick<CardAnnotationV1, 'w' | 'h'>): boolean {
  return annot.w <= 0 && annot.h <= 0;
}

export function omitCustomFieldKey(map: CustomFieldsMap, fieldId: string): CustomFieldsMap {
  if (!(fieldId in map)) return map;
  const next = { ...map };
  delete next[fieldId];
  return next;
}

export function serializeCustomFieldsMap(map: CustomFieldsMap): string | null {
  const keys = Object.keys(map);
  if (!keys.length) return null;
  return JSON.stringify(map);
}

export function customFieldsMapToSearchText(map: CustomFieldsMap): string {
  const parts: string[] = [];
  for (const value of Object.values(map)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) parts.push(trimmed);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const trimmed = item.trim();
        if (trimmed) parts.push(trimmed);
      }
    }
  }
  return parts.join('\n');
}

export function customFieldsJsonToSearchText(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') {
    return customFieldsMapToSearchText(sanitizeCustomFieldsMap(parseJsonColumn(raw, {})));
  }
  return customFieldsMapToSearchText(sanitizeCustomFieldsMap(raw));
}

export function reorderTemplateFields(
  fields: DetailTemplateField[],
  id: string,
  insertIndex: number
): DetailTemplateField[] {
  const from = fields.findIndex((f) => f.id === id);
  if (from < 0) return fields;
  const next = [...fields];
  const [item] = next.splice(from, 1);
  let to = insertIndex;
  if (from < to) to -= 1;
  to = Math.max(0, Math.min(next.length, to));
  next.splice(to, 0, item);
  return next;
}

/** Перестановка только среди полей, для которых listed=true; остальные остаются на местах. */
export function reorderVisibleTemplateFields(
  fields: DetailTemplateField[],
  id: string,
  insertIndex: number,
  listed?: (field: DetailTemplateField) => boolean
): DetailTemplateField[] {
  const isListed = listed ?? ((field: DetailTemplateField) => field.visibility === 'always');
  const visible = fields.filter(isListed);
  const nextVisible = reorderTemplateFields(visible, id, insertIndex);
  let index = 0;
  return fields.map((field) => (isListed(field) ? nextVisible[index++]! : field));
}

/** Переставить подпоследовательность id внутри полного списка, не трогая остальные слоты. */
export function mergeSubsequenceOrder<T extends { id: string }>(
  all: T[],
  newSubsequenceOrder: string[]
): T[] {
  const wanted = new Set(newSubsequenceOrder);
  const slots: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (wanted.has(all[i]!.id)) slots.push(i);
  }
  if (slots.length !== newSubsequenceOrder.length) return all;
  const byId = new Map(all.map((item) => [item.id, item]));
  const next = [...all];
  for (let i = 0; i < slots.length; i++) {
    const item = byId.get(newSubsequenceOrder[i]!);
    if (!item) return all;
    next[slots[i]!] = item;
  }
  return next;
}

export function serializeAnnotations(annotations: CardAnnotationV1[]): {
  json: string | null;
  text: string | null;
} {
  if (!annotations.length) return { json: null, text: null };
  const text = annotationsToSearchText(annotations);
  return { json: JSON.stringify(annotations), text: text || null };
}
