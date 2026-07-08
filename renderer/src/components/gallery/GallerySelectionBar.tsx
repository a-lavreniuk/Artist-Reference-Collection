import { useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import { formatSelectedCardsLabel } from './gallerySelectionCopy';

export type GallerySelectionBarVariant = 'library' | 'collection' | 'moodboard' | 'trash';

type Props = {
  selectedCount: number;
  variant: GallerySelectionBarVariant;
  onAddToMoodboard?: () => void;
  onRemoveFromMoodboard?: () => void;
  onCollectionAction?: () => void;
  onTrashAction?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onClear: () => void;
};

function ActionButton({
  label,
  iconClass,
  onClick
}: {
  label: string;
  iconClass: string;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label} delay={500} position="top">
      <button
        type="button"
        className="btn btn-ghost btn-ds btn-m btn-icon-only"
        aria-label={label}
        onClick={onClick}
      >
        <span className={`btn-icon-only__glyph ${iconClass}`} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

function snapBarToPixelGrid(host: HTMLElement): void {
  host.style.left = '';
  host.style.right = '';
  host.style.marginInline = '';
  const width = host.offsetWidth;
  const left = Math.round((window.innerWidth - width) / 2);
  host.style.left = `${left}px`;
  host.style.right = 'auto';
}

export default function GallerySelectionBar({
  selectedCount,
  variant,
  onAddToMoodboard,
  onRemoveFromMoodboard,
  onCollectionAction,
  onTrashAction,
  onRestore,
  onPermanentDelete,
  onClear
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const sync = () => {
      void hydrateArcNavbarIcons(host);
      snapBarToPixelGrid(host);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(host);
    window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [selectedCount, variant]);

  if (selectedCount <= 0) return null;

  const collectionLabel = variant === 'collection' ? 'Убрать из коллекции' : 'Добавить в коллекцию';
  const collectionIcon = 'arc-icon-layout-grid';

  return (
    <div
      ref={hostRef}
      className="arc-gallery-selection-bar arc-navbar-island arc-ui-kit-scope"
      data-btn-size="m"
      data-elevation="default"
      data-typo-tone="white"
      role="toolbar"
      aria-label="Действия с выбранными карточками"
    >
      <div className="arc-gallery-selection-bar__counter text-m">
        {formatSelectedCardsLabel(selectedCount)}
      </div>

      {variant === 'trash' ? (
        <>
          {onRestore ? (
            <ActionButton label="Восстановить" iconClass="arc-icon-undo" onClick={onRestore} />
          ) : null}
          {onPermanentDelete ? (
            <ActionButton label="Удалить навсегда" iconClass="arc-icon-trash" onClick={onPermanentDelete} />
          ) : null}
        </>
      ) : (
        <>
          {onRemoveFromMoodboard ? (
            <ActionButton label="Убрать из мудборда" iconClass="arc-icon-bookmark-minus" onClick={onRemoveFromMoodboard} />
          ) : null}
          {onAddToMoodboard ? (
            <ActionButton label="Добавить в мудборд" iconClass="arc-icon-bookmark-plus" onClick={onAddToMoodboard} />
          ) : null}
          {onCollectionAction ? (
            <ActionButton label={collectionLabel} iconClass={collectionIcon} onClick={onCollectionAction} />
          ) : null}
          {onTrashAction ? (
            <ActionButton label="Отправить в корзину" iconClass="arc-icon-trash" onClick={onTrashAction} />
          ) : null}
        </>
      )}

      <Tooltip content="Снять выделение" delay={500} position="top">
        <button
          type="button"
          className="btn btn-ghost btn-ds btn-m btn-icon-only"
          aria-label="Снять выделение"
          onClick={onClear}
        >
          <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}

