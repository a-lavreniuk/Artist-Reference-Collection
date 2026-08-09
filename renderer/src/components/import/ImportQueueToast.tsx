import { useOverlayMotion } from '../../motion';
import { Loader } from '../loader';

export type ImportQueueProgress = {
  current: number;
  total: number;
  etaMs: number | null;
  cancelling?: boolean;
};

type Props = {
  progress: ImportQueueProgress;
  onCancel: () => void;
};

/**
 * Toast прогресса ручного импорта.
 * Макет: ARC-2 Loader [712:4031] — спиннер + «Добавлено N из M карточек…» + btn-brand S «Отменить».
 */
export default function ImportQueueToast({ progress, onCancel }: Props) {
  const alertRef = useOverlayMotion<HTMLDivElement>(true, {
    preset: 'fade-slide-up'
  });

  const status = progress.cancelling
    ? 'Отмена после текущего файла…'
    : `Добавлено ${progress.current} из ${progress.total} карточек…`;

  return (
    <div className="demo-alert-host arc-import-queue-toast-host" aria-live="polite" aria-atomic="true">
      <div
        ref={alertRef}
        className="arc-import-queue-toast arc-ui-kit-scope"
        role="status"
        data-btn-size="s"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.current}
        aria-label={status}
      >
        <Loader decorative size="inline" className="arc-import-queue-toast__loader" />
        <p className="arc-import-queue-toast__message">{status}</p>
        <button
          type="button"
          className="btn btn-brand btn-ds arc-import-queue-toast__cancel"
          disabled={progress.cancelling}
          onClick={onCancel}
        >
          <span className="btn-ds__value">Отменить</span>
        </button>
      </div>
    </div>
  );
}
