import { useMemo } from 'react';
import { findNearestPantones, formatPantoneCode } from '../../utils/pantoneColors';

type PantoneNearestMatchesProps = {
  colorHex: string;
  onSelect: (hex: string) => void;
  count?: number;
};

/** Ближайшие Pantone к выбранному цвету (Figma 1902-19518 / 1907-20260). */
export default function PantoneNearestMatches({
  colorHex,
  onSelect,
  count = 6
}: PantoneNearestMatchesProps) {
  const matches = useMemo(() => findNearestPantones(colorHex, count), [colorHex, count]);
  if (matches.length === 0) return null;

  return (
    <div className="arc-pantone-matches">
      <p className="text-s arc-pantone-matches__title">Ближайшие совпадения</p>
      <div className="arc-pantone-matches__list" role="list">
        {matches.map((entry) => (
          <button
            key={entry.code}
            type="button"
            role="listitem"
            className="arc-pantone-chip"
            onClick={() => onSelect(entry.hex)}
            aria-label={`Pantone ${formatPantoneCode(entry.code)}, ${entry.hex}`}
          >
            <span className="arc-pantone-chip__swatch" style={{ background: entry.hex }} aria-hidden="true" />
            <span className="arc-pantone-chip__meta">
              <span className="arc-pantone-chip__code">{formatPantoneCode(entry.code)}</span>
              <span className="text-s arc-pantone-chip__hex">{entry.hex}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
