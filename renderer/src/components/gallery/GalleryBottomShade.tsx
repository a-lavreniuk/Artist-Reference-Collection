import { useMemo } from 'react';
import { buildBlurLayers } from '../layout/shadeBlurLayers';

const GALLERY_BOTTOM_SHADE_MAX_BLUR_PX = 8;
const GALLERY_BOTTOM_SHADE_LAYER_COUNT = 4;

export default function GalleryBottomShade() {
  const layers = useMemo(
    () =>
      buildBlurLayers({
        layerCount: GALLERY_BOTTOM_SHADE_LAYER_COUNT,
        maxBlurPx: GALLERY_BOTTOM_SHADE_MAX_BLUR_PX,
        direction: 'toBottom'
      }),
    []
  );

  return (
    <div className="arc-gallery-bottom-shade" aria-hidden="true">
      <div className="arc-gallery-bottom-shade__blur">
        {layers.map(({ blur, mask }, i) => (
          <div
            key={i}
            className="arc-gallery-bottom-shade__blur-layer"
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask
            }}
          />
        ))}
      </div>
      <div className="arc-gallery-bottom-shade__tint" />
    </div>
  );
}
