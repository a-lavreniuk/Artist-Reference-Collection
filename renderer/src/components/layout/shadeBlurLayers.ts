export type ShadeBlurDirection = 'toTop' | 'toBottom';

export type ShadeBlurLayer = {
  blur: number;
  mask: string;
};

export function buildBlurLayers(params: {
  layerCount: number;
  maxBlurPx: number;
  direction: ShadeBlurDirection;
}): ShadeBlurLayer[] {
  const { layerCount, maxBlurPx, direction } = params;
  const step = 1 / layerCount;
  const gradientDir = direction === 'toTop' ? 'to top' : 'to bottom';

  return Array.from({ length: layerCount }, (_, idx) => {
    const i = idx + 1;
    const t = layerCount <= 1 ? 1 : (i - 1) / (layerCount - 1);
    const blur = layerCount <= 1 ? maxBlurPx : maxBlurPx * t;
    const o = (i - 1) * step * 100;
    const s = step * 100;
    const mask = `linear-gradient(${gradientDir}, rgba(0,0,0,0) ${o}%, rgba(0,0,0,1) ${o + s}%, rgba(0,0,0,1) ${o + 2 * s}%, rgba(0,0,0,0) ${o + 3 * s}%)`;
    return { blur, mask };
  });
}
