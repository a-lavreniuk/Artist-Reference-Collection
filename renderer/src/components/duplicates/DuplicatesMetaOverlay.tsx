import type { CardRecord } from '../../services/arcSchema';
import { formatFileMeta, toDisplayPath } from './duplicateCompareUtils';

type Props = {
  card: CardRecord | null;
  libraryRootAbs: string | null;
  libraryName?: string | null;
  align: 'left' | 'right';
};

export default function DuplicatesMetaOverlay({ card, libraryRootAbs, libraryName, align }: Props) {
  if (!card) return <div className={`arc-duplicates-meta-bar arc-duplicates-meta-bar--${align}`} />;
  const meta = formatFileMeta(card);
  const path = toDisplayPath(libraryRootAbs, card.originalRelativePath);
  return (
    <div className={`arc-duplicates-meta-bar arc-duplicates-meta-bar--${align}`}>
      <div className="arc-duplicates-meta-bar__row text-m">
        <span>{meta.format}</span>
        <span>{meta.resolution}</span>
        <span>{meta.size}</span>
        {libraryName ? <span>{libraryName}</span> : null}
      </div>
      <p className="arc-duplicates-meta-bar__path text-s">{path}</p>
    </div>
  );
}
