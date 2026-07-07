import type { TagRecord, CategoryRecord } from '../../../../services/db';
import { formatNavbarTabCount } from '../../../../search/formatNavbarTabCount';

type NavbarSearchTagChipProps = {
  tag: TagRecord;
  category?: CategoryRecord;
  onRemove: () => void;
};

/** Чип метки в строке поиска (multiselect bar). */
export default function NavbarSearchTagChip({ tag, category, onRemove }: NavbarSearchTagChipProps) {
  const color = category?.colorHex ?? 'var(--gray-500)';
  const count = tag.usageCount ?? 0;
  const countLabel = count > 0 ? formatNavbarTabCount(count) : null;

  return (
    <span
      role="button"
      tabIndex={0}
      className="chip chip-active"
      aria-label={`Снять метку ${tag.name}`}
      onClick={onRemove}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRemove();
        }
      }}
    >
      <span className="chip-color" style={{ background: color }} aria-hidden="true" />
      <span>{tag.name}</span>
      {countLabel ? <span className="chip-count">{countLabel}</span> : null}
      <span className="chip-remove" aria-hidden="true">
        ✕
      </span>
    </span>
  );
}
