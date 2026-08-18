import type { PointerEvent as ReactPointerEvent } from 'react';

type Props = {
  number: number;
  clusterCount?: number;
  anchorId: string;
  ariaLabel: string;
  interactive?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

/** Номер аннотации: chip без маркера и счётчика, фон brand. */
export default function CardDetailAnnotationPin({
  number,
  clusterCount,
  anchorId,
  ariaLabel,
  interactive = true,
  onPointerDown
}: Props) {
  const label =
    clusterCount != null && clusterCount > 1 ? (
      <>
        <span className="arc-card-detail-annot-pin-chip__count">{clusterCount}</span>
        <span>{number}</span>
      </>
    ) : (
      number
    );

  if (!interactive) {
    return (
      <span
        className="chip arc-card-detail-annot-pin-chip text-s"
        data-annot-anchor={anchorId}
        aria-hidden="true"
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="chip arc-card-detail-annot-pin-chip text-s"
      data-annot-pin=""
      data-annot-anchor={anchorId}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
    >
      {label}
    </button>
  );
}
