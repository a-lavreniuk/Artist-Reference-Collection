import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { DISPLAY_SCALE_PCT_MAX, DISPLAY_SCALE_PCT_MIN } from '../../hooks/imageViewportZoomMath';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import ValueSlider from '../range-slider/ValueSlider';
import { Tooltip } from '../tooltip/Tooltip';
import { formatBytes, formatResolution } from './cardFileMetaFormat';
import type { NaturalImageSize } from './cardFileMetaFormat';

type Props = {
  card: CardRecord;
  naturalSize: NaturalImageSize;
  displayScalePct: number;
  isFitActive: boolean;
  isActualActive: boolean;
  disabled?: boolean;
  onInfoClick: () => void;
  onFitClick: () => void;
  onActualClick: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onDisplayPctChange: (pct: number) => void;
};

function parseDisplayPctInput(raw: string): number | null {
  const cleaned = raw.replace(/%/g, '').trim();
  if (!cleaned) return null;
  const value = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(value)) return null;
  return value;
}

export default function CardDetailPreviewOptionsBar({
  card,
  naturalSize,
  displayScalePct,
  isFitActive,
  isActualActive,
  disabled = false,
  onInfoClick,
  onFitClick,
  onActualClick,
  onZoomOut,
  onZoomIn,
  onDisplayPctChange
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pctDraft, setPctDraft] = useState('');
  const [pctEditing, setPctEditing] = useState(false);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [card.id, displayScalePct]);

  const pctLabel = `${displayScalePct}%`;

  const commitPctDraft = () => {
    const parsed = parseDisplayPctInput(pctDraft);
    setPctEditing(false);
    if (parsed === null) return;
    const clamped = Math.max(DISPLAY_SCALE_PCT_MIN, Math.min(DISPLAY_SCALE_PCT_MAX, parsed));
    onDisplayPctChange(clamped);
  };

  const onPctKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitPctDraft();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setPctEditing(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="arc-card-detail-preview-options arc-ui-kit-scope"
      data-btn-size="s"
      data-input-size="s"
      aria-label="Параметры превью"
    >
      <div className="arc-card-detail-preview-options__meta">
        <Tooltip content="Информация о файле" position="top">
          <button
            type="button"
            className="btn btn-outline btn-icon-only btn-ds"
            aria-label="Информация о файле"
            disabled={disabled}
            onClick={onInfoClick}
          >
            <span className="btn-icon-only__glyph arc-icon-info" aria-hidden="true" />
          </button>
        </Tooltip>
        <div className="arc-card-detail-preview-options__meta-item">
          <span
            className="arc-card-detail-preview-options__meta-icon arc-icon-aspect-ratio-other"
            data-arc-icon-size="m"
            aria-hidden="true"
          />
          <span className="text-s arc-card-detail-preview-options__meta-text">
            {formatResolution(card, naturalSize) ?? '—'}
          </span>
        </div>
        <div className="arc-card-detail-preview-options__meta-item">
          <span
            className="arc-card-detail-preview-options__meta-icon arc-icon-save"
            data-arc-icon-size="m"
            aria-hidden="true"
          />
          <span className="text-s arc-card-detail-preview-options__meta-text">
            {formatBytes(card.fileSize) ?? '—'}
          </span>
        </div>
      </div>

      <div className="arc-card-detail-preview-options__zoom">
        <Tooltip content="Вписать в экран" position="top">
          <button
            type="button"
            className={`btn btn-outline btn-icon-only btn-ds${isFitActive ? ' is-active' : ''}`}
            aria-label="Вписать в экран"
            aria-pressed={isFitActive}
            disabled={disabled}
            onClick={onFitClick}
          >
            <span className="btn-icon-only__glyph arc-icon-maximize" aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip content="Реальный размер" position="top">
          <button
            type="button"
            className={`btn btn-outline btn-icon-only btn-ds${isActualActive ? ' is-active' : ''}`}
            aria-label="Реальный размер"
            aria-pressed={isActualActive}
            disabled={disabled}
            onClick={onActualClick}
          >
            <span className="btn-icon-only__glyph arc-icon-resolution" aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip content="Уменьшить" position="top">
          <button
            type="button"
            className="btn btn-outline btn-icon-only btn-ds"
            aria-label="Уменьшить"
            disabled={disabled || displayScalePct <= DISPLAY_SCALE_PCT_MIN}
            onClick={onZoomOut}
          >
            <span className="btn-icon-only__glyph arc-icon-minus" aria-hidden="true" />
          </button>
        </Tooltip>
        <div className="arc-card-detail-preview-options__slider">
          <ValueSlider
            min={DISPLAY_SCALE_PCT_MIN}
            max={DISPLAY_SCALE_PCT_MAX}
            step={1}
            size="s"
            value={displayScalePct}
            formatValue={(v) => `${v}%`}
            ariaLabel="Масштаб изображения"
            showValue={false}
            disabled={disabled}
            onChange={onDisplayPctChange}
          />
        </div>
        <Tooltip content="Увеличить" position="top">
          <button
            type="button"
            className="btn btn-outline btn-icon-only btn-ds"
            aria-label="Увеличить"
            disabled={disabled || displayScalePct >= DISPLAY_SCALE_PCT_MAX}
            onClick={onZoomIn}
          >
            <span className="btn-icon-only__glyph arc-icon-plus" aria-hidden="true" />
          </button>
        </Tooltip>
        <label className="field input-live has-value arc-card-detail-preview-options__pct-field">
          <input
            type="text"
            className="input arc-card-detail-preview-options__pct-input"
            inputMode="numeric"
            aria-label="Масштаб в процентах"
            disabled={disabled}
            value={pctEditing ? pctDraft : pctLabel}
            onFocus={() => {
              setPctEditing(true);
              setPctDraft(String(displayScalePct));
            }}
            onChange={(event) => setPctDraft(event.target.value)}
            onBlur={commitPctDraft}
            onKeyDown={onPctKeyDown}
          />
        </label>
      </div>
    </div>
  );
}
