import './TagTooltipBody.css';

export interface TagTooltipBodyProps {
  description?: string;
  /** data:image/... из TagRecord.tooltipImageDataUrl */
  imageDataUrl?: string;
}

export function TagTooltipBody({ description, imageDataUrl }: TagTooltipBodyProps) {
  const hasText = Boolean(description?.trim());
  const hasImage = Boolean(imageDataUrl?.startsWith('data:image/'));
  if (!hasText && !hasImage) return null;

  return (
    <div className="arc-tag-tooltip">
      {hasText ? <div className="arc-tag-tooltip__text">{description}</div> : null}
      {hasImage ? (
        <div className="arc-tag-preview-frame arc-tag-preview-frame--thumb" aria-hidden={!hasText}>
          <img src={imageDataUrl} alt="" loading="lazy" decoding="async" />
        </div>
      ) : null}
    </div>
  );
}
