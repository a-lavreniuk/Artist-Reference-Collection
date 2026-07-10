export const DISPLAY_SCALE_PCT_MIN = 100;
export const DISPLAY_SCALE_PCT_MAX = 1000;
export const ZOOM_WHEEL_FACTOR = 1.08;

export type ViewportPan = {
  scale: number;
  panX: number;
  panY: number;
};

export type StageSize = {
  width: number;
  height: number;
};

export type NaturalSize = {
  width: number;
  height: number;
};

export function computeFitScale(
  stage: StageSize,
  natural: NaturalSize
): number {
  if (stage.width <= 0 || stage.height <= 0 || natural.width <= 0 || natural.height <= 0) {
    return 1;
  }
  return Math.min(stage.width / natural.width, stage.height / natural.height);
}

export function maxScaleForFit(fitScale: number): number {
  return fitScale * (DISPLAY_SCALE_PCT_MAX / DISPLAY_SCALE_PCT_MIN);
}

export function clampScale(scale: number, fitScale: number): number {
  const maxScale = maxScaleForFit(fitScale);
  return Math.max(fitScale, Math.min(maxScale, scale));
}

export function scaleToDisplayPct(scale: number, fitScale: number): number {
  if (fitScale <= 0) return DISPLAY_SCALE_PCT_MIN;
  const pct = Math.round((scale / fitScale) * DISPLAY_SCALE_PCT_MIN);
  return Math.max(DISPLAY_SCALE_PCT_MIN, Math.min(DISPLAY_SCALE_PCT_MAX, pct));
}

export function displayPctToScale(displayPct: number, fitScale: number): number {
  const clampedPct = Math.max(
    DISPLAY_SCALE_PCT_MIN,
    Math.min(DISPLAY_SCALE_PCT_MAX, displayPct)
  );
  return clampScale((clampedPct / DISPLAY_SCALE_PCT_MIN) * fitScale, fitScale);
}

function baseOffset(
  stage: StageSize,
  natural: NaturalSize,
  scale: number
): { baseX: number; baseY: number } {
  return {
    baseX: (stage.width - natural.width * scale) / 2,
    baseY: (stage.height - natural.height * scale) / 2
  };
}

export function zoomAtPoint(
  stage: StageSize,
  natural: NaturalSize,
  viewport: ViewportPan,
  fitScale: number,
  focalX: number,
  focalY: number,
  factor: number
): ViewportPan {
  const { scale, panX, panY } = viewport;
  if (natural.width <= 0 || natural.height <= 0) return viewport;

  const newScale = clampScale(scale * factor, fitScale);
  const { baseX, baseY } = baseOffset(stage, natural, scale);
  const imgX = (focalX - baseX - panX) / scale;
  const imgY = (focalY - baseY - panY) / scale;
  const nextBase = baseOffset(stage, natural, newScale);

  return {
    scale: newScale,
    panX: focalX - nextBase.baseX - imgX * newScale,
    panY: focalY - nextBase.baseY - imgY * newScale
  };
}

export function setScaleAtCenter(
  stage: StageSize,
  natural: NaturalSize,
  viewport: ViewportPan,
  fitScale: number,
  nextScale: number
): ViewportPan {
  const focalX = stage.width / 2;
  const focalY = stage.height / 2;
  const factor = viewport.scale > 0 ? nextScale / viewport.scale : 1;
  const zoomed = zoomAtPoint(stage, natural, viewport, fitScale, focalX, focalY, factor);
  return {
    ...zoomed,
    scale: clampScale(nextScale, fitScale)
  };
}

export function setDisplayPctAtCenter(
  stage: StageSize,
  natural: NaturalSize,
  viewport: ViewportPan,
  fitScale: number,
  displayPct: number
): ViewportPan {
  const nextScale = displayPctToScale(displayPct, fitScale);
  return setScaleAtCenter(stage, natural, viewport, fitScale, nextScale);
}

export function clampPan(
  panX: number,
  panY: number,
  stage: StageSize,
  natural: NaturalSize,
  scale: number
): { panX: number; panY: number } {
  const dispW = natural.width * scale;
  const dispH = natural.height * scale;
  const { baseX, baseY } = baseOffset(stage, natural, scale);
  const margin = 32;

  const minPanX = margin - baseX - dispW;
  const maxPanX = stage.width - margin - baseX;
  const minPanY = margin - baseY - dispH;
  const maxPanY = stage.height - margin - baseY;

  if (minPanX > maxPanX) {
    return { panX: 0, panY: clamp(panY, minPanY, maxPanY) };
  }
  if (minPanY > maxPanY) {
    return { panX: clamp(panX, minPanX, maxPanX), panY: 0 };
  }

  return {
    panX: clamp(panX, minPanX, maxPanX),
    panY: clamp(panY, minPanY, maxPanY)
  };
}

export function canPan(stage: StageSize, natural: NaturalSize, scale: number, fitScale: number): boolean {
  if (scale <= fitScale + 1e-6) return false;
  return natural.width * scale > stage.width + 1 || natural.height * scale > stage.height + 1;
}

export function isViewportAtFit(viewport: ViewportPan, fitScale: number): boolean {
  return (
    Math.abs(viewport.scale - fitScale) < 1e-4 &&
    Math.abs(viewport.panX) < 1 &&
    Math.abs(viewport.panY) < 1
  );
}

export function isViewportAtActual(viewport: ViewportPan): boolean {
  return Math.abs(viewport.scale - 1) < 1e-4;
}

export function viewportAtActualSize(
  stage: StageSize,
  natural: NaturalSize,
  viewport: ViewportPan,
  fitScale: number
): ViewportPan {
  const next = setScaleAtCenter(stage, natural, viewport, fitScale, 1);
  const clampedPan = clampPan(next.panX, next.panY, stage, natural, next.scale);
  return { scale: next.scale, panX: clampedPan.panX, panY: clampedPan.panY };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
