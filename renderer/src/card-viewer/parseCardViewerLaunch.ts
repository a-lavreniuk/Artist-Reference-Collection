export type CardViewerLaunchParams = {
  cardIds: string[];
  startIndex: number;
};

export function parseCardViewerLaunch(search: string): CardViewerLaunchParams {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const cardIds = (params.get('cards') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const rawIndex = Number(params.get('index') ?? 0);
  const startIndex = Number.isFinite(rawIndex) ? Math.max(0, Math.floor(rawIndex)) : 0;
  return {
    cardIds,
    startIndex: cardIds.length === 0 ? 0 : Math.min(startIndex, cardIds.length - 1)
  };
}
