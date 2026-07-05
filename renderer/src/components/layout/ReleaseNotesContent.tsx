import { formatReleaseVersionLine } from './releaseNotesFormat';

export type ReleaseNotesContentData = {
  version: string;
  buildDate: string;
  changes: string[];
};

type Props = ReleaseNotesContentData & {
  className?: string;
};

export default function ReleaseNotesContent({ version, buildDate, changes, className }: Props) {
  return (
    <div className={className ?? 'arc-release-notes-content'}>
      <p className="arc-release-notes-content__version text-m">{formatReleaseVersionLine(version, buildDate)}</p>
      {changes.map((line) => (
        <p key={line} className="arc-release-notes-content__paragraph text-m">
          {line}
        </p>
      ))}
    </div>
  );
}
