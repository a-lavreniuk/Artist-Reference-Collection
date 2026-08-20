import {
  templateFieldIconClass,
  templateFieldLabel,
  type DetailCardTemplateV1,
  type DetailTemplateField
} from '@arc-main-shared/detailCardTemplate';

export function listedUserFilterFields(
  template: DetailCardTemplateV1,
  customPresence: Record<string, { has: number; missing: number }> | undefined
): DetailTemplateField[] {
  return template.fields.filter(
    (field) => field.showInFilters && (customPresence?.[field.id]?.has ?? 0) > 0
  );
}

export function customFilterMenuKey(fieldId: string): string {
  return `custom:${fieldId}`;
}

export function parseCustomFilterMenuKey(key: string): string | null {
  if (!key.startsWith('custom:')) return null;
  const id = key.slice('custom:'.length);
  return id || null;
}

export function userFilterChipMeta(field: DetailTemplateField): { label: string; iconClass: string } {
  return {
    label: templateFieldLabel(field),
    iconClass: templateFieldIconClass(field)
  };
}
