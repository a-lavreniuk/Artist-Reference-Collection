export const TRASH_RETENTION_DAYS = [7, 30, 90, 0] as const;
export type TrashRetentionDays = (typeof TRASH_RETENTION_DAYS)[number];

export function sanitizeTrashRetentionDays(raw: unknown): TrashRetentionDays {
  if (raw === 7 || raw === 30 || raw === 90 || raw === 0) return raw;
  if (raw === '7' || raw === '30' || raw === '90' || raw === '0') {
    return Number(raw) as TrashRetentionDays;
  }
  return 30;
}

/** ISO cutoff; `days <= 0` means never auto-purge. */
export function trashCutoffIso(now: Date, days: number): string | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  const ms = Math.round(days) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms).toISOString();
}

/** Empty / missing `deleted_at` is never expired. ISO strings compare lexicographically. */
export function isExpiredDeletedAt(deletedAt: string | null | undefined, cutoffIso: string): boolean {
  if (typeof deletedAt !== 'string') return false;
  const t = deletedAt.trim();
  if (!t) return false;
  return t < cutoffIso;
}
