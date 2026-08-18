function tokenPx(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : fallback;
}

export function positionAnnotationFloatingPanel(panel: HTMLElement, anchorKey: string) {
  const anchor = document.querySelector<HTMLElement>(`[data-annot-anchor="${anchorKey}"]`);
  const clampRoot =
    document.querySelector<HTMLElement>('.arc-card-detail-preview') ??
    document.querySelector<HTMLElement>('.arc-card-detail-preview__stage');
  if (!anchor || !clampRoot) return false;

  const gap = tokenPx('--s-2', 8);
  const pin = anchor.getBoundingClientRect();
  const clamp = clampRoot.getBoundingClientRect();
  const box = panel.getBoundingClientRect();
  const width = box.width || 280;
  const height = box.height || 96;

  let left = pin.right + gap;
  if (left + width > clamp.right) {
    left = pin.left - gap - width;
  }
  left = Math.min(Math.max(left, clamp.left + gap), Math.max(clamp.left + gap, clamp.right - width - gap));

  let top = pin.top;
  if (top + height > clamp.bottom) {
    top = clamp.bottom - height - gap;
  }
  top = Math.min(Math.max(top, clamp.top + gap), Math.max(clamp.top + gap, clamp.bottom - height - gap));

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.visibility = 'visible';
  return true;
}

export function readAnnotationAnchorPoint(anchorKey: string): { x: number; y: number } | null {
  const anchor = document.querySelector<HTMLElement>(`[data-annot-anchor="${anchorKey}"]`);
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
