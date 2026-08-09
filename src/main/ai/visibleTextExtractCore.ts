/**
 * Pure helpers: merge on-image text into ai_caption (no Electron).
 */

/** Stable marker so reindex can replace the visible-text block without duplicating it. */
export const VISIBLE_TEXT_MARKER = 'Visible text:';

export const VISIBLE_TEXT_EXTRACT_PROMPT =
  'Extract all readable text visible in this image (UI labels, buttons, titles, menus, captions). ' +
  'Quote text exactly in the original language (Russian and English are both expected). ' +
  'Output only the extracted strings, one per line. ' +
  'Do not describe the image, invent text, or translate. ' +
  'If there is no readable text, reply with exactly: NONE';

const EMPTY_VISIBLE_RE = /^(none|n\/a|no text|no readable text|нет текста|текста нет)\.?$/i;

export function normalizeVisibleText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !EMPTY_VISIBLE_RE.test(line));

  const joined = lines.join('\n').trim();
  if (!joined || EMPTY_VISIBLE_RE.test(joined)) return '';
  return joined;
}

/** Remove a previously merged Visible text block (idempotent reindex). */
export function stripVisibleTextBlock(caption: string): string {
  const idx = caption.indexOf(VISIBLE_TEXT_MARKER);
  if (idx === -1) return caption.trimEnd();
  return caption.slice(0, idx).trimEnd();
}

export function mergeCaptionWithVisibleText(descriptiveCaption: string, visibleText: string): string {
  const base = stripVisibleTextBlock(descriptiveCaption).trim();
  const visible = normalizeVisibleText(visibleText);
  if (!visible) return base;
  if (!base) return `${VISIBLE_TEXT_MARKER}\n${visible}`;
  return `${base}\n\n${VISIBLE_TEXT_MARKER}\n${visible}`;
}
