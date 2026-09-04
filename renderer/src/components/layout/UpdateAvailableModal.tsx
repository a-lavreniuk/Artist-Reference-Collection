import { useLayoutEffect, useRef } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from './FloatingModalPanel';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

export type UpdateModalPhase = 'prompt' | 'downloading' | 'installing';

type Props = {
  version: string;
  phase: UpdateModalPhase;
  downloadPercent: number | null;
  onUpdate: () => void;
  onLater: () => void;
  onCancelDownload: () => void;
};

export default function UpdateAvailableModal({
  version,
  phase,
  downloadPercent,
  onUpdate,
  onLater,
  onCancelDownload
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [version, phase, downloadPercent]);

  const message =
    phase === 'installing'
      ? 'Устанавливаем обновление… Приложение скоро перезапустится.'
      : phase === 'downloading'
        ? downloadPercent != null
          ? `Загрузка обновления… ${Math.round(downloadPercent)}%`
          : 'Загрузка обновления…'
        : `Доступна новая версия ${version}. Нажмите «Обновить» — загрузка и перезапуск произойдут автоматически.`;

  return (
    <ArcAnimatedModalHost onClose={onLater} closeDisabled={phase !== 'prompt'}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="update-available-modal"
          className="arc-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcUpdateModalTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcUpdateModalTitle">
              Обновление ARC
            </h3>
            {phase === 'prompt' || phase === 'downloading' ? (
              <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={phase === 'downloading' ? onCancelDownload : requestClose}>
                <span className="tab-icon arc-icon-close" aria-hidden="true" />
              </button>
            ) : null}
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">{message}</p>
            </div>
          </div>
          {phase === 'prompt' ? (
            <footer className="arc-modal__footer arc-modal__footer--actions-2">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
                <span className="btn-ds__value">Позже</span>
              </button>
              <button type="button" className="btn btn-brand btn-ds btn-s" onClick={onUpdate}>
                <span className="btn-ds__value">Обновить</span>
              </button>
            </footer>
          ) : phase === 'downloading' ? (
            <footer className="arc-modal__footer arc-modal__footer--actions-1">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onCancelDownload}>
                <span className="btn-ds__value">Отменить</span>
              </button>
            </footer>
          ) : (
            <footer className="arc-modal__footer arc-modal__footer--actions-1">
              <button type="button" className="btn btn-brand btn-ds btn-s" disabled>
                <span className="btn-ds__value">Подождите…</span>
              </button>
            </footer>
          )}
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
