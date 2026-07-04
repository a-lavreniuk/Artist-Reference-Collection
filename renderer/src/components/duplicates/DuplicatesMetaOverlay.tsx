import type { CardRecord } from '../../services/arcSchema';
import { formatFileMeta, toDisplayPath } from './duplicateCompareUtils';

type Props = {
  card: CardRecord | null;
  libraryRootAbs: string | null;
  align: 'left' | 'right';
};

export default function DuplicatesMetaOverlay({ card, libraryRootAbs, align }: Props) {
  if (!card) return null;
  const meta = formatFileMeta(card);
  const path = toDisplayPath(libraryRootAbs, card.originalRelativePath);
  return (
    <div className={`arc-duplicates-meta-overlay arc-duplicates-meta-overlay--${align}`}>
      <div className="arc-duplicates-meta-overlay__row typo-p-m">
        <span>{meta.format}</span>
        <span>{meta.resolution}</span>
        <span>{meta.size}</span>
      </div>
      <p className="arc-duplicates-meta-overlay__path typo-p-s" title={path}>
        {path}
      </p>
    </div>
  );
}
