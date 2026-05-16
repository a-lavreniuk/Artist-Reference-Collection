import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArc2NavbarIcons } from './navbarIconHydrate';

type Props = {
  version: string;
  downloading: boolean;
  downloadPercent: number | null;
  readyToInstall: boolean;
  onUpdate: () => void;
  onLater: () => void;
};

export default function UpdateAvailableModal({
  version,
  downloading,
  downloadPercent,
  readyToInstall,
  onUpdate,
  onLater
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArc2NavbarIcons(hostRef.current);
  }, [version, downloading, readyToInstall]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !downloading) onLater();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [downloading, onLater]);

  const message = readyToInstall
    ? 'Обновление загружено. Перезапустить приложение сейчас?'
    : downloading
      ? downloadPercent != null
        ? `Загрузка обновления… ${Math.round(downloadPercent)}%`
        : 'Загрузка обновления…'
      : `Доступна новая версия ${version}. Установить обновление?`;

  const primaryLabel = readyToInstall ? 'Перезапустить' : downloading ? 'Загрузка…' : 'Обновить';

  return (
    <div
      ref={hostRef}
      className="arc-modal-host"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget && !downloading) onLater();
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
          {!downloading ? (
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
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button
            type="button"
            className="btn btn-outline btn-ds btn-s"
            disabled={downloading}
            onClick={onLater}
          >
            <span className="btn-ds__value">Позже</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-ds btn-s"
            disabled={downloading && !readyToInstall}
            onClick={onUpdate}
          >
            <span className="btn-ds__value">{primaryLabel}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
