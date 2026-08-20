import type { CustomFieldType, DetailCardTemplateV1, DetailTemplateField } from '../shared/detailCardTemplate';
import { isSafeFieldId, isStarterFieldId } from '../shared/detailCardTemplate';
import {
  isCustomDateFilter,
  isCustomPresenceFilter,
  isCustomSelectFilter,
  type CustomFieldFilterValue
} from '../shared/galleryFilterCore';

export function fieldValueSql(field: DetailTemplateField, alias: string): string | null {
  if (!isSafeFieldId(field.id)) return null;
  if (field.id === 'name') return `COALESCE(${alias}.name, '')`;
  if (field.id === 'link') return `COALESCE(${alias}.link_url, '')`;
  if (field.id === 'description') return `COALESCE(${alias}.description, '')`;
  return `COALESCE(json_extract(${alias}.custom_fields_json, '$.${field.id}'), '')`;
}

export function fieldHasValueSql(field: DetailTemplateField, alias: string): string | null {
  const expr = fieldValueSql(field, alias);
  if (!expr) return null;
  if (field.type === 'multiSelect' && !isStarterFieldId(field.id)) {
    return `(json_type(${alias}.custom_fields_json, '$.${field.id}') = 'array' AND json_array_length(${alias}.custom_fields_json, '$.${field.id}') > 0)`;
  }
  return `(${expr} != '')`;
}

export function fieldMissingValueSql(field: DetailTemplateField, alias: string): string | null {
  const has = fieldHasValueSql(field, alias);
  if (!has) return null;
  return `(NOT ${has})`;
}

function escapeLike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function appendCustomFieldFilterSql(
  field: DetailTemplateField,
  value: CustomFieldFilterValue,
  alias: string,
  wh: string[],
  binds: unknown[]
): void {
  if (isCustomPresenceFilter(value)) {
    const hasSql = fieldHasValueSql(field, alias);
    const missSql = fieldMissingValueSql(field, alias);
    if (!hasSql || !missSql) return;
    if (value.mode === 'missing') {
      wh.push(missSql);
      return;
    }
    wh.push(hasSql);
    const words = (value.keywords ?? '')
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    const expr = fieldValueSql(field, alias);
    if (!expr) return;
    for (const word of words) {
      wh.push(`LOWER(${expr}) LIKE ? ESCAPE '\\'`);
      binds.push(`%${escapeLike(word)}%`);
    }
    return;
  }

  if (isCustomSelectFilter(value) && value.values.length) {
    if (field.type === 'multiSelect' && !isStarterFieldId(field.id)) {
      const parts = value.values.map(() => `EXISTS (
        SELECT 1 FROM json_each(json_extract(${alias}.custom_fields_json, '$.${field.id}'))
        WHERE json_each.value = ?
      )`);
      wh.push(`(${parts.join(' OR ')})`);
      binds.push(...value.values);
      return;
    }
    const expr = fieldValueSql(field, alias);
    if (!expr) return;
    wh.push(`(${expr} IN (${value.values.map(() => '?').join(',')}))`);
    binds.push(...value.values);
    return;
  }

  if (isCustomDateFilter(value) && value.ranges.length) {
    const expr = fieldValueSql(field, alias);
    if (!expr) return;
    const parts: string[] = [];
    for (const range of value.ranges) {
      if (range.preset === 'custom') {
        parts.push(`(${expr} >= ? AND ${expr} <= ?)`);
        binds.push(range.from, range.to ?? range.from);
      }
    }
    if (parts.length) wh.push(`(${parts.join(' OR ')})`);
  }
}

export function customFieldSortSql(
  field: DetailTemplateField,
  direction: 'ASC' | 'DESC',
  alias: string
): string | null {
  const expr = fieldValueSql(field, alias);
  if (!expr) return null;
  const dir = direction;
  if (field.type === 'select' && field.options?.length) {
    const cases = field.options
      .map((opt, index) => `WHEN ${expr} = ${sqlStringLiteral(opt)} THEN ${index}`)
      .join(' ');
    return `ORDER BY CASE ${cases} ELSE 9999 END ${dir}, ${alias}.added_at DESC`;
  }
  if (field.type === 'multiSelect' && field.options?.length && !isStarterFieldId(field.id)) {
    const first = `COALESCE((
      SELECT MIN(
        CASE json_each.value
          ${field.options.map((opt, index) => `WHEN ${sqlStringLiteral(opt)} THEN ${index}`).join(' ')}
          ELSE 9999
        END
      )
      FROM json_each(json_extract(${alias}.custom_fields_json, '$.${field.id}'))
    ), 9999)`;
    return `ORDER BY ${first} ${dir}, ${alias}.added_at DESC`;
  }
  if (field.type === 'date') {
    return `ORDER BY ${expr} ${dir}, ${alias}.added_at DESC`;
  }
  return `ORDER BY ${expr} COLLATE NOCASE ${dir}, ${alias}.added_at DESC`;
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function templateFieldById(
  template: DetailCardTemplateV1 | undefined,
  fieldId: string
): DetailTemplateField | undefined {
  return template?.fields.find((field) => field.id === fieldId);
}

export function fieldTypeForFilter(type: CustomFieldType): 'presence' | 'select' | 'date' {
  if (type === 'select' || type === 'multiSelect') return 'select';
  if (type === 'date') return 'date';
  return 'presence';
}
