import { useLayoutEffect, useRef } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { ZOOM_WHEEL_FACTOR } from '../../hooks/imageViewportZoomMath';
import { useImageViewportZoom } from '../../hooks/useImageViewportZoom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import CardDetailPreviewOptionsBar from './CardDetailPreviewOptionsBar';

type Props = {
  card: CardRecord;
  src: string;
  onInfoClick: () => void;
};

export default function CardDetailImageViewport({ card, src, onInfoClick }: Props) {
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
  } = useImageViewportZoom(`${card.id}:${src}`);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [card.id, displayScalePct]);

  return (
    <div ref={rootRef} className="arc-card-detail-image-viewport">
      <div
        ref={stageRef}
        className={`arc-card-detail-image-stage${panEnabled ? ' arc-card-detail-image-stage--pannable' : ''}`}
        {...stageHandlers}
      >
        <div className="arc-card-detail-image-stage__layer">
          <img
            className="arc-card-detail-image-stage__media"
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

      <CardDetailPreviewOptionsBar
        card={card}
        naturalSize={naturalSize}
        displayScalePct={displayScalePct}
        isFitActive={isFitActive}
        isActualActive={isActualActive}
        onInfoClick={onInfoClick}
        onFitClick={resetToFit}
        onActualClick={resetToActual}
        onZoomOut={() => zoomCenterFactor(1 / ZOOM_WHEEL_FACTOR)}
        onZoomIn={() => zoomCenterFactor(ZOOM_WHEEL_FACTOR)}
        onDisplayPctChange={setDisplayPct}
      />
    </div>
  );
}
