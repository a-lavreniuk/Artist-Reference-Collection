import { useLayoutEffect, useRef } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import type { CardAnnotationV1 } from '@arc-main-shared/detailCardTemplate';
import { ZOOM_WHEEL_FACTOR } from '../../hooks/imageViewportZoomMath';
import { useImageViewportZoom } from '../../hooks/useImageViewportZoom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import type { NaturalImageSize } from './cardFileMetaFormat';
import CardDetailAnnotationLayer, { type AnnotationDraftRect } from './CardDetailAnnotationLayer';

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
  commentMode?: boolean;
  editMode?: boolean;
  annotationsVisible?: boolean;
  annotations?: CardAnnotationV1[];
  selectedAnnotationId?: string | null;
  focusedAnnotationId?: string | null;
  sparkleAnnotationId?: string | null;
  composerAnchorId?: string | null;
  draftRect?: AnnotationDraftRect | null;
  draftIndex?: number;
  onSelectAnnotation?: (id: string) => void;
  onCreateAnnotation?: (rect: AnnotationDraftRect) => void;
  onUpdateAnnotation?: (id: string, rect: AnnotationDraftRect) => void;
  hoveredAnnotationId?: string | null;
  onHoverAnnotation?: (id: string | null) => void;
  onPeekAnnotation?: (anchorKey: string | null) => void;
};

export default function CardDetailImageViewport({
  card,
  src,
  onChromeChange,
  commentMode = false,
  editMode = false,
  annotationsVisible = true,
  annotations = [],
  selectedAnnotationId = null,
  focusedAnnotationId = null,
  sparkleAnnotationId = null,
  composerAnchorId = null,
  draftRect = null,
  draftIndex,
  onSelectAnnotation,
  onCreateAnnotation,
  onUpdateAnnotation,
  hoveredAnnotationId = null,
  onHoverAnnotation,
  onPeekAnnotation
}: Props) {
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
        className={`arc-card-detail-image-stage${panEnabled && !commentMode ? ' arc-card-detail-image-stage--pannable' : ''}${commentMode ? ' arc-card-detail-image-stage--comment' : ''}`}
        {...(commentMode ? {} : stageHandlers)}
      >
        <div className="arc-card-detail-image-stage__layer">
          <div className="arc-card-detail-image-stage__transformed" style={mediaTransformStyle}>
            <img
              key={card.id}
              className="arc-card-detail-image-stage__media arc-card-detail-image-stage__media--fade"
              src={src}
              alt=""
              draggable={false}
              onLoad={(event) => {
                const el = event.currentTarget;
                onImageLoad(el.naturalWidth, el.naturalHeight);
              }}
            />
            <CardDetailAnnotationLayer
              annotations={annotations}
              annotationsVisible={annotationsVisible}
              editMode={editMode}
              commentMode={commentMode}
              selectedId={selectedAnnotationId}
              focusedId={focusedAnnotationId}
              hoveredId={hoveredAnnotationId}
              sparkleId={sparkleAnnotationId}
              composerAnchorId={composerAnchorId}
              draftRect={draftRect}
              draftIndex={draftIndex}
              onSelect={onSelectAnnotation}
              onHover={onHoverAnnotation}
              onPeek={onPeekAnnotation}
              onCreate={onCreateAnnotation}
              onUpdate={onUpdateAnnotation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
