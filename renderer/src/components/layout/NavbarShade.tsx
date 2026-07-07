import { useMemo } from 'react';
import { buildBlurLayers } from './shadeBlurLayers';

const SHADE_MAX_BLUR_PX = 16;

export default function NavbarShade() {
  const layers = useMemo(
    () =>
      buildBlurLayers({
        layerCount: 8,
        maxBlurPx: SHADE_MAX_BLUR_PX,
        direction: 'toTop'
      }),
    []
  );

  return (
    <div className="arc-navbar-shade" aria-hidden="true">
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
      <div className="arc-navbar-shade__tint" />
    </div>
  );
}
