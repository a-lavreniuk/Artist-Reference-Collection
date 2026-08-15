import { useLayoutEffect, useRef } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { ZOOM_WHEEL_FACTOR } from '../../hooks/imageViewportZoomMath';
import { useImageViewportZoom } from '../../hooks/useImageViewportZoom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import type { NaturalImageSize } from './cardFileMetaFormat';

export type CardDetailImageChrome = {
  naturalSize: NaturalImageSize;
  displayScalePct: number;
  isFitActive: boolean;
  isActualActive: boolean;
  onFitClick: () => void;
  onActualClick: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onDisplayPctChange: (pct: number) => void;
};

type Props = {
  card: CardRecord;
  src: string;
  onChromeChange?: (chrome: CardDetailImageChrome) => void;
};

export default function CardDetailImageViewport({ card, src, onChromeChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    stageRef,
    naturalSize,
    displayScalePct,
    isFitActive,
    isActualActive,
    panEnabled,
    mediaTransformStyle,
    onImageLoad,
    zoomCenterFactor,
    setDisplayPct,
    resetToFit,
    resetToActual,
    stageHandlers
  } = useImageViewportZoom(card.id);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, []);

  const chromeReady = naturalSize.width > 0 && naturalSize.height > 0;

  useLayoutEffect(() => {
    onChromeChange?.({
      naturalSize,
      displayScalePct: chromeReady ? displayScalePct : 100,
      isFitActive: chromeReady ? isFitActive : true,
      isActualActive: chromeReady ? isActualActive : false,
      onFitClick: resetToFit,
      onActualClick: resetToActual,
      onZoomOut: () => zoomCenterFactor(1 / ZOOM_WHEEL_FACTOR),
      onZoomIn: () => zoomCenterFactor(ZOOM_WHEEL_FACTOR),
      onDisplayPctChange: setDisplayPct
    });
  }, [
    chromeReady,
    displayScalePct,
    isActualActive,
    isFitActive,
    naturalSize,
    onChromeChange,
    resetToActual,
    resetToFit,
    setDisplayPct,
    zoomCenterFactor
  ]);

  return (
    <div ref={rootRef} className="arc-card-detail-image-viewport">
      <div
        ref={stageRef}
        className={`arc-card-detail-image-stage${panEnabled ? ' arc-card-detail-image-stage--pannable' : ''}`}
        {...stageHandlers}
      >
        <div className="arc-card-detail-image-stage__layer">
          <img
            key={card.id}
            className="arc-card-detail-image-stage__media arc-card-detail-image-stage__media--fade"
            src={src}
            alt=""
            draggable={false}
            style={mediaTransformStyle}
            onLoad={(event) => {
              const el = event.currentTarget;
              onImageLoad(el.naturalWidth, el.naturalHeight);
            }}
          />
        </div>
      </div>
    </div>
  );
}
