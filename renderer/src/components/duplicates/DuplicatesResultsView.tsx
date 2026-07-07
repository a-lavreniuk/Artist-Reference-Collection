import type { CardRecord } from '../../services/arcSchema';
import { EMPTY_STATE_COPY } from '../../content/emptyStates';
import { EmptyState } from '../empty-state';
import type { DuplicatesCompareMode } from './duplicateCompareTypes';
import DuplicatesMetaOverlay from './DuplicatesMetaOverlay';
import { DuplicatesDetailsPanels } from './DuplicatesDetails';
import DuplicatesWipeCompare from './DuplicatesWipeCompare';

type Props = {
  mode: DuplicatesCompareMode;
  cardA: CardRecord | null;
  cardB: CardRecord | null;
  urlA: string | null;
  urlB: string | null;
  libraryRootAbs: string | null;
  busy: boolean;
  queueComplete?: boolean;
  onGoToLibrary?: () => void;
  onNotDuplicate: () => void;
  onSkip: () => void;
  onDeleteA: () => void;
  onDeleteB: () => void;
  onMergeA: () => void;
  onMergeB: () => void;
};

export default function DuplicatesResultsView({
  mode,
  cardA,
  cardB,
  urlA,
  urlB,
  libraryRootAbs,
  busy,
  queueComplete = false,
  onGoToLibrary,
  onNotDuplicate,
  onSkip,
  onDeleteA,
  onDeleteB,
  onMergeA,
  onMergeB
}: Props) {
  const singleStage = mode === 'overlay';

  if (queueComplete) {
    return (
      <div className="arc-duplicates-main">
        <EmptyState
          {...EMPTY_STATE_COPY.duplicatesQueueComplete}
          fill
          onPrimaryAction={onGoToLibrary}
        />
      </div>
    );
  }

  return (
    <div className="arc-duplicates-main">
      <div
        className={`arc-duplicates-stage-row${singleStage ? ' arc-duplicates-stage-row--single' : ''}`}
      >
        {mode === 'sideBySide' ? (
          <>
            <div className="arc-duplicates-panel arc-duplicates-panel--image">
              <div className="arc-duplicates-side">
                {urlA ? <img className="arc-duplicates-side__img" src={urlA} alt="" draggable={false} /> : null}
                <DuplicatesMetaOverlay card={cardA} libraryRootAbs={libraryRootAbs} align="left" />
              </div>
            </div>
            <div className="arc-duplicates-panel arc-duplicates-panel--image">
              <div className="arc-duplicates-side">
                {urlB ? <img className="arc-duplicates-side__img" src={urlB} alt="" draggable={false} /> : null}
                <DuplicatesMetaOverlay card={cardB} libraryRootAbs={libraryRootAbs} align="right" />
              </div>
            </div>
          </>
        ) : null}

        {mode === 'overlay' ? (
          <div className="arc-duplicates-panel arc-duplicates-panel--image">
            <DuplicatesWipeCompare
              cardA={cardA}
              cardB={cardB}
              urlA={urlA}
              urlB={urlB}
              libraryRootAbs={libraryRootAbs}
            />
          </div>
        ) : null}

        {mode === 'metadata' ? (
          <DuplicatesDetailsPanels cardA={cardA} cardB={cardB} libraryRootAbs={libraryRootAbs} />
        ) : null}
      </div>

      <div className="arc-duplicates-actions panel elevation-default arc-ui-kit-scope" data-btn-size="l" data-elevation="default">
        <button type="button" className="btn btn-secondary btn-ds" disabled={busy} onClick={onNotDuplicate}>
          <span className="btn-ds__value">Не дубликаты</span>
        </button>

        <div className="arc-duplicates-actions__center">
          <button type="button" className="btn btn-primary btn-ds" disabled={busy} onClick={onDeleteA}>
            <span className="btn-ds__value">Удалить A</span>
          </button>
          <button type="button" className="btn btn-brand btn-ds" disabled={busy} onClick={onMergeA}>
            <span className="btn-ds__value">Объединить в A</span>
          </button>
          <button type="button" className="btn btn-brand btn-ds" disabled={busy} onClick={onMergeB}>
            <span className="btn-ds__value">Объединить в B</span>
          </button>
          <button type="button" className="btn btn-primary btn-ds" disabled={busy} onClick={onDeleteB}>
            <span className="btn-ds__value">Удалить B</span>
          </button>
        </div>

        <button type="button" className="btn btn-secondary btn-ds" disabled={busy} onClick={onSkip}>
          <span className="btn-ds__value">Пропустить</span>
        </button>
      </div>
    </div>
  );
}
