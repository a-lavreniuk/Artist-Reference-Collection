/** ISO YYYY-MM-DD → DD.MM.YYYY */
export function formatBuildDate(isoDate: string): string {
  const parts = isoDate.trim().split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  }
  return isoDate;
}

export function formatReleaseVersionLine(version: string, buildDate: string): string {
  return `Версия ${version} · ${formatBuildDate(buildDate)}`;
}
