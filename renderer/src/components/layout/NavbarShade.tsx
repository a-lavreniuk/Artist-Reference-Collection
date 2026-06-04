import { useMemo } from 'react';

const SHADE_MAX_BLUR_PX = 16;

type BlurLayer = {
  blur: number;
  mask: string;
};

function buildBlurLayers(layerCount: number, maxBlur: number): BlurLayer[] {
  const step = 1 / layerCount;
  return Array.from({ length: layerCount }, (_, idx) => {
    const i = idx + 1;
    // Линейно: нижний слой 0px, верхний maxBlur (равномерный шаг по высоте)
    const blur =
      layerCount <= 1 ? maxBlur : (maxBlur * (i - 1)) / (layerCount - 1);
    const o = (i - 1) * step * 100;
    const s = step * 100;
    const mask = `linear-gradient(to top, rgba(0,0,0,0) ${o}%, rgba(0,0,0,1) ${o + s}%, rgba(0,0,0,1) ${o + 2 * s}%, rgba(0,0,0,0) ${o + 3 * s}%)`;
    return { blur, mask };
  });
}

type Props = {
  filtersOpen: boolean;
  /** Пока открыт поиск — без backdrop-filter (иначе белая кайма по краю окна в Electron). */
  pauseBackdropBlur?: boolean;
};

export default function NavbarShade({ filtersOpen, pauseBackdropBlur = false }: Props) {
  const layers = useMemo(
    () => buildBlurLayers(filtersOpen ? 16 : 8, SHADE_MAX_BLUR_PX),
    [filtersOpen]
  );

  return (
    <div className="arc-navbar-shade" aria-hidden="true">
      {!pauseBackdropBlur ? (
        <div className="arc-navbar-shade__blur">
          {layers.map(({ blur, mask }, i) => (
            <div
              key={i}
              className="arc-navbar-shade__blur-layer"
              style={{
                backdropFilter: `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage: mask,
                WebkitMaskImage: mask
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
