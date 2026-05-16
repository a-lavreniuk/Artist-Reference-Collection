import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArc2NavbarIcons } from './navbarIconHydrate';

export type UpdateModalPhase = 'prompt' | 'downloading' | 'installing';

type Props = {
  version: string;
  phase: UpdateModalPhase;
  downloadPercent: number | null;
  onUpdate: () => void;
  onLater: () => void;
};

export default function UpdateAvailableModal({
  version,
  phase,
  downloadPercent,
  onUpdate,
  onLater
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const busy = phase === 'downloading' || phase === 'installing';

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArc2NavbarIcons(hostRef.current);
  }, [version, phase, downloadPercent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase === 'prompt') onLater();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, onLater]);

  const message =
    phase === 'installing'
      ? 'Устанавливаем обновление… Приложение скоро перезапустится.'
      : phase === 'downloading'
        ? downloadPercent != null
          ? `Загрузка обновления… ${Math.round(downloadPercent)}%`
          : 'Загрузка обновления…'
        : `Доступна новая версия ${version}. Нажмите «Обновить» — загрузка и перезапуск произойдут автоматически.`;

  return (
    <div
      ref={hostRef}
      className="arc-modal-host"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget && phase === 'prompt') onLater();
      }}
    >
      <section
        className="arc-modal"
        data-elevation="raised"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arc2UpdateModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arc2UpdateModalTitle">
            Обновление ARC
          </h3>
          {phase === 'prompt' ? (
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onLater}>
              <span className="tab-icon arc2-icon-close" aria-hidden="true" />
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
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onLater}>
              <span className="btn-ds__value">Позже</span>
            </button>
            <button type="button" className="btn btn-primary btn-ds btn-s" onClick={onUpdate}>
              <span className="btn-ds__value">Обновить</span>
            </button>
          </footer>
        ) : (
          <footer className="arc-modal__footer arc-modal__footer--actions-1">
            <button type="button" className="btn btn-primary btn-ds btn-s" disabled>
              <span className="btn-ds__value">{busy ? 'Подождите…' : 'Обновить'}</span>
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
