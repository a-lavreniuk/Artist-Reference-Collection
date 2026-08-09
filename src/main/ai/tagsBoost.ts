const TOKEN_RE = /[\p{L}\p{N}]+/gu;

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(TOKEN_RE);
  if (!matches) return [];
  return [...new Set(matches.filter((token) => token.length >= 2))];
}

export function computeTagsBoost(query: string, tagNames: string[], maxBoost: number): number {
  const queryTokens = tokenize(query);
  if (!queryTokens.length || !tagNames.length) return 0;

  const normalizedTags = tagNames.map((name) => name.toLowerCase().trim()).filter(Boolean);
  if (!normalizedTags.length) return 0;

  let hits = 0;
  for (const token of queryTokens) {
    const matched = normalizedTags.some(
      (tag) => tag === token || tag.includes(token) || token.includes(tag)
    );
    if (matched) hits += 1;
  }

  const ratio = hits / queryTokens.length;
  return Math.min(maxBoost, ratio * maxBoost);
}

/**
 * Literal boost when the AI query appears in the card's AI caption
 * (includes merged on-image / UI text from indexing).
 */
export function computeCaptionTextBoost(
  query: string,
  captionText: string,
  maxBoost: number
): number {
  if (maxBoost <= 0) return 0;
  const queryTrimmed = query.trim();
  const caption = captionText.trim();
  if (!queryTrimmed || !caption) return 0;

  const captionLower = caption.toLowerCase();
  const queryLower = queryTrimmed.toLowerCase();

  if (queryLower.length >= 2 && captionLower.includes(queryLower)) {
    return maxBoost;
  }

  const queryTokens = tokenize(queryTrimmed);
  if (!queryTokens.length) return 0;

  let hits = 0;
  for (const token of queryTokens) {
    if (captionLower.includes(token)) hits += 1;
  }

  const ratio = hits / queryTokens.length;
  return Math.min(maxBoost, ratio * maxBoost);
}
