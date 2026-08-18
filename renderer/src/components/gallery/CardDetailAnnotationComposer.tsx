import { useLayoutEffect, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

export type AnnotationComposerMode = 'create' | 'edit';

type Props = {
  mode: AnnotationComposerMode;
  text: string;
  onTextChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** Ключ `data-annot-anchor` на пине. */
  anchorKey: string;
};

function tokenPx(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : fallback;
}

function positionComposer(panel: HTMLElement, anchorKey: string) {
  const anchor = document.querySelector<HTMLElement>(`[data-annot-anchor="${anchorKey}"]`);
  const clampRoot =
    document.querySelector<HTMLElement>('.arc-card-detail-preview') ??
    document.querySelector<HTMLElement>('.arc-card-detail-preview__stage');
  if (!anchor || !clampRoot) return;

  const gap = tokenPx('--s-2', 8);
  const pin = anchor.getBoundingClientRect();
  const clamp = clampRoot.getBoundingClientRect();
  const box = panel.getBoundingClientRect();
  const width = box.width || 400;
  const height = box.height || 152;

  let left = pin.right + gap;
  if (left + width > clamp.right) {
    left = pin.left - gap - width;
  }
  left = Math.min(Math.max(left, clamp.left + gap), Math.max(clamp.left + gap, clamp.right - width - gap));

  let top = pin.top;
  if (top + height > clamp.bottom) {
    top = clamp.bottom - height - gap;
  }
  top = Math.min(Math.max(top, clamp.top + gap), Math.max(clamp.top + gap, clamp.bottom - height - gap));

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.visibility = 'visible';
}

export default function CardDetailAnnotationComposer({
  mode,
  text,
  onTextChange,
  onSave,
  onCancel,
  onDelete,
  anchorKey
}: Props) {
  const panelRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSave = Boolean(text.trim());

  useLayoutEffect(() => {
    if (panelRef.current) void hydrateArcNavbarIcons(panelRef.current);
  }, [mode]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let raf = 0;
    const tick = () => {
      positionComposer(panel, anchorKey);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchorKey, mode, text]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const focusField = () => {
      el.focus({ preventScroll: true });
    };
    focusField();
    const frame = window.requestAnimationFrame(focusField);
    const timer = window.setTimeout(focusField, 0);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [anchorKey, mode]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    onSave();
  };

  return createPortal(
    <form
      ref={panelRef}
      className="arc-modal arc-card-detail-annot-composer"
      data-elevation="raised"
      data-input-size="m"
      data-btn-size="s"
      role="dialog"
      aria-label={mode === 'edit' ? 'Аннотация' : 'Новая аннотация'}
      onSubmit={onSubmit}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {mode === 'edit' ? (
        <header className="arc-modal__header">
          <h3 className="arc-modal__title">Аннотация</h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onCancel}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
      ) : null}
      <div className="arc-modal__body">
        <div className="arc-modal__slot">
          <label className="field">
            <textarea
              ref={textareaRef}
              className="input textarea"
              rows={3}
              placeholder="Комментарий"
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  onCancel();
                }
              }}
            />
          </label>
        </div>
      </div>
      {mode === 'edit' ? (
        <footer className="arc-modal__footer arc-modal__footer--actions-3">
          <button type="button" className="btn btn-danger btn-ds btn-s" onClick={onDelete}>
            <span className="btn-ds__value">Удалить</span>
          </button>
          <div className="arc-modal__footer-right">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onCancel}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button type="submit" className="btn btn-brand btn-ds btn-s" disabled={!canSave}>
              <span className="btn-ds__value">Сохранить</span>
            </button>
          </div>
        </footer>
      ) : (
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onCancel}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button type="submit" className="btn btn-brand btn-ds btn-s" disabled={!canSave}>
            <span className="btn-ds__value">Сохранить</span>
          </button>
        </footer>
      )}
    </form>,
    document.body
  );
}
