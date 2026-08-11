import { useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';

type Props = {
  selectedCount: number;
  onShowInGallery: () => void;
  onMoveToCategory: () => void;
  onMerge: () => void;
  onDelete: () => void;
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

export default function TagsSelectionBar({
  selectedCount,
  onShowInGallery,
  onMoveToCategory,
  onMerge,
  onDelete,
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
  }, [selectedCount]);

  if (selectedCount < 1) return null;

  const single = selectedCount === 1;

  return (
    <div
      ref={hostRef}
      className="arc-gallery-selection-bar arc-tags-selection-bar arc-navbar-island arc-ui-kit-scope"
      data-btn-size="m"
      data-elevation="default"
      data-typo-tone="white"
      role="toolbar"
      aria-label="Действия с выбранными метками"
    >
      <div className="arc-gallery-selection-bar__counter text-m">Выбрано меток: {selectedCount}</div>

      <ActionButton
        label={single ? 'Показать в галерее' : 'Показать карточки по меткам'}
        iconClass="arc-icon-image"
        onClick={onShowInGallery}
      />
      <ActionButton
        label="Переместить в категорию"
        iconClass="arc-icon-chevrons-up-down"
        onClick={onMoveToCategory}
      />
      {single ? null : (
        <ActionButton label="Объединить метки" iconClass="arc-icon-reuse" onClick={onMerge} />
      )}
      <ActionButton
        label={single ? 'Удалить метку' : 'Удалить метки'}
        iconClass="arc-icon-trash"
        onClick={onDelete}
      />
      <ActionButton label="Снять выделение" iconClass="arc-icon-close" onClick={onClear} />
    </div>
  );
}
