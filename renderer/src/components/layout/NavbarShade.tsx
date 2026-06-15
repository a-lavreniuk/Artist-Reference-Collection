import { useMemo } from 'react';
import { buildBlurLayers } from './shadeBlurLayers';

const SHADE_MAX_BLUR_PX = 16;

type Props = {
  filtersOpen: boolean;
  /** Пока открыт поиск — без backdrop-filter (иначе белая кайма по краю окна в Electron). */
  pauseBackdropBlur?: boolean;
};

export default function NavbarShade({ filtersOpen, pauseBackdropBlur = false }: Props) {
  const layers = useMemo(
    () =>
      buildBlurLayers({
        layerCount: filtersOpen ? 16 : 8,
        maxBlurPx: SHADE_MAX_BLUR_PX,
        direction: 'toTop'
      }),
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
      <div className="arc-navbar-shade__tint" />
    </div>
  );
}
