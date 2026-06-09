import type { CategoryRecord, TagRecord } from '../../services/db';

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

export function tagMatchesSearch(tag: TagRecord, q: string): boolean {
  if (!q) return true;
  const name = tag.name.toLowerCase();
  const desc = tag.description?.toLowerCase() ?? '';
  return name.includes(q) || desc.includes(q);
}

export function categoryHasSearchMatch(cat: CategoryRecord, tags: TagRecord[], q: string): boolean {
  if (!q) return true;
  if (cat.name.toLowerCase().includes(q)) return true;
  return tags.some((t) => tagMatchesSearch(t, q));
}

export function filterSidebarCategories(
  categories: readonly CategoryRecord[],
  tagsByCat: Record<string, TagRecord[]>,
  q: string,
  selectedCategoryId: string | null
): CategoryRecord[] {
  if (!q) return [...categories];
  return categories.filter((cat) => {
    if (selectedCategoryId === cat.id) return true;
    return categoryHasSearchMatch(cat, tagsByCat[cat.id] ?? [], q);
  });
}

export function buildTagPickerGroups(
  categories: readonly CategoryRecord[],
  tagsByCat: Record<string, TagRecord[]>,
  q: string,
  selectedCategoryId: string | null
): { cat: CategoryRecord; tags: TagRecord[] }[] {
  const scopeCats =
    selectedCategoryId === null ? categories : categories.filter((c) => c.id === selectedCategoryId);

  const rows: { cat: CategoryRecord; tags: TagRecord[] }[] = [];

  for (const cat of scopeCats) {
    const allT = tagsByCat[cat.id] ?? [];
    if (!q) {
      rows.push({ cat, tags: allT });
      continue;
    }

    const catNameMatch = cat.name.toLowerCase().includes(q);
    const matchingTags = allT.filter((t) => tagMatchesSearch(t, q));
    if (!catNameMatch && matchingTags.length === 0) continue;
    rows.push({ cat, tags: catNameMatch ? allT : matchingTags });
  }

  return rows;
}
