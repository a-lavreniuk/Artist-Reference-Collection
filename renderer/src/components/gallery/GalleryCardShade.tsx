import { useMemo, type CSSProperties } from 'react';
import { buildBlurLayers } from '../layout/shadeBlurLayers';

const CARD_SHADE_MAX_BLUR_PX = 16;
const CARD_SHADE_LAYER_COUNT = 6;

type Props = {
  tintColor?: string;
  active?: boolean;
  className?: string;
};

export default function GalleryCardShade({ tintColor, active = false, className = '' }: Props) {
  const layers = useMemo(
    () =>
      buildBlurLayers({
        layerCount: CARD_SHADE_LAYER_COUNT,
        maxBlurPx: CARD_SHADE_MAX_BLUR_PX,
        direction: 'toBottom'
      }),
    []
  );

  const rootClass = ['arc-gallery-card-shade', active ? 'is-active' : '', className]
    .filter(Boolean)
    .join(' ');
  const tintStyle: CSSProperties = {
    ...(tintColor ? { '--arc-gallery-card-shade-color': tintColor } : {})
  };

  return (
    <div className={rootClass} aria-hidden="true" style={tintStyle}>
      <div className="arc-gallery-card-shade__bottom">
        <div className="arc-gallery-card-shade__blur">
          {layers.map(({ blur, mask }, i) => (
            <div
              key={i}
              className="arc-gallery-card-shade__blur-layer"
              style={{
                backdropFilter: `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage: mask,
                WebkitMaskImage: mask
              }}
            />
          ))}
        </div>
        <div className="arc-gallery-card-shade__tint" />
      </div>
    </div>
  );
}
