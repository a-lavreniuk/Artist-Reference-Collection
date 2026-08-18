/** Шаблон блока «Описание» деталки и значения/аннотации карточки. */

export const DETAIL_BUILTIN_FIELD_IDS = ['name', 'link', 'description'] as const;
export type DetailBuiltinFieldId = (typeof DETAIL_BUILTIN_FIELD_IDS)[number];

export const CUSTOM_FIELD_TYPES = [
  'shortText',
  'longText',
  'url',
  'date',
  'select',
  'multiSelect'
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const DETAIL_BUILTIN_FIELD_LABELS: Record<DetailBuiltinFieldId, string> = {
  name: 'Имя',
  link: 'Ссылка',
  description: 'Описание'
};

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  shortText: 'Короткий текст',
  longText: 'Текстовый блок',
  url: 'Ссылка',
  date: 'Дата',
  select: 'Селектор',
  multiSelect: 'Мультивыбор'
};

export type DetailTemplateBuiltinField = {
  id: DetailBuiltinFieldId;
  kind: 'builtin';
  visible: boolean;
};

export type DetailTemplateCustomField = {
  id: string;
  kind: 'custom';
  type: CustomFieldType;
  label: string;
  visible: boolean;
  options?: string[];
};

export type DetailTemplateField = DetailTemplateBuiltinField | DetailTemplateCustomField;

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
const BUILTIN_SET = new Set<string>(DETAIL_BUILTIN_FIELD_IDS);

export function defaultDetailCardTemplate(): DetailCardTemplateV1 {
  return {
    version: 1,
    fields: DETAIL_BUILTIN_FIELD_IDS.map((id) => ({
      id,
      kind: 'builtin' as const,
      visible: true
    }))
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

function sanitizeCustomField(raw: unknown): DetailTemplateCustomField | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string' || !rec.id.trim()) return null;
  if (!isCustomFieldType(rec.type)) return null;
  const label = typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : CUSTOM_FIELD_TYPE_LABELS[rec.type];
  const field: DetailTemplateCustomField = {
    id: rec.id.trim(),
    kind: 'custom',
    type: rec.type,
    label,
    visible: rec.visible !== false
  };
  if (rec.type === 'select' || rec.type === 'multiSelect') {
    field.options = sanitizeOptions(rec.options);
  }
  return field;
}

export function sanitizeDetailCardTemplate(raw: unknown): DetailCardTemplateV1 {
  const fallback = defaultDetailCardTemplate();
  if (!raw || typeof raw !== 'object') return fallback;
  const rec = raw as Record<string, unknown>;
  const list = Array.isArray(rec.fields) ? rec.fields : [];
  const fields: DetailTemplateField[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (row.kind === 'builtin' && typeof row.id === 'string' && BUILTIN_SET.has(row.id)) {
      const id = row.id as DetailBuiltinFieldId;
      if (seen.has(id)) continue;
      seen.add(id);
      fields.push({ id, kind: 'builtin', visible: row.visible !== false });
      continue;
    }
    if (row.kind === 'custom') {
      const custom = sanitizeCustomField(row);
      if (!custom || seen.has(custom.id) || BUILTIN_SET.has(custom.id)) continue;
      seen.add(custom.id);
      fields.push(custom);
    }
  }

  for (const id of DETAIL_BUILTIN_FIELD_IDS) {
    if (!seen.has(id)) {
      fields.push({ id, kind: 'builtin', visible: true });
    }
  }

  return { version: 1, fields };
}

export function createCustomTemplateField(type: CustomFieldType, id: string): DetailTemplateCustomField {
  const field: DetailTemplateCustomField = {
    id,
    kind: 'custom',
    type,
    label: CUSTOM_FIELD_TYPE_LABELS[type],
    visible: true
  };
  if (type === 'select' || type === 'multiSelect') field.options = [];
  return field;
}

export function templateFieldLabel(field: DetailTemplateField): string {
  if (field.kind === 'builtin') return DETAIL_BUILTIN_FIELD_LABELS[field.id];
  return field.label;
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

export function serializeAnnotations(annotations: CardAnnotationV1[]): {
  json: string | null;
  text: string | null;
} {
  if (!annotations.length) return { json: null, text: null };
  const text = annotationsToSearchText(annotations);
  return { json: JSON.stringify(annotations), text: text || null };
}
