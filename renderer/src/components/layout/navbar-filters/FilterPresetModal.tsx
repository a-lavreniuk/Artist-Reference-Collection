import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';

type Props = {
  title: string;
  submitLabel: string;
  initialName?: string;
  existingLowerNames: Set<string>;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export default function FilterPresetModal({
  title,
  submitLabel,
  initialName = '',
  existingLowerNames,
  onClose,
  onSubmit
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [emptySubmitted, setEmptySubmitted] = useState(false);

  const trimmed = name.trim();
  const duplicate = Boolean(trimmed) && existingLowerNames.has(trimmed.toLowerCase());
  const fieldDanger = (!trimmed && emptySubmitted) || duplicate;

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [name, busy, emptySubmitted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (busy) return;
    if (!trimmed) {
      setEmptySubmitted(true);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={hostRef}
      className="arc-modal-host arc-navbar-no-drag"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="arc-modal"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcFilterPresetTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header">
          <h2 id="arcFilterPresetTitle" className="arc-modal__title">
            {title}
          </h2>
          <button type="button" className="btn btn-ds btn-icon-only btn-s" aria-label="Закрыть" onClick={onClose}>
            <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <label className={`field input-live${fieldDanger ? ' field-error' : ''}`}>
            <input
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setEmptySubmitted(false);
              }}
              placeholder="Название пресета"
              aria-invalid={fieldDanger || undefined}
              autoFocus
            />
          </label>
        </div>
        <footer className="arc-modal__footer">
          <button type="button" className="btn btn-ds btn-s btn-outline" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="btn btn-ds btn-s btn-primary" onClick={() => void handleSubmit()} disabled={busy}>
            {submitLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
