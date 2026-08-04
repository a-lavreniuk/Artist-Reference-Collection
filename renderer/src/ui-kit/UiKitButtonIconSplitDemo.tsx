import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu, type ContextMenuRow } from '../components/context-menu';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';

type StubLibrary = {
  id: string;
  name: string;
  cardCount: number;
};

const STUB_LIBRARIES: StubLibrary[] = [
  { id: 'lib-main', name: 'Основная', cardCount: 128 },
  { id: 'lib-refs', name: 'Референсы', cardCount: 42 },
  { id: 'lib-archive', name: 'Архив', cardCount: 7 }
];

type Palette = 'brand' | 'ghost';

type SplitSampleProps = {
  idTag: string;
  palette: Palette;
  label: string;
  cardCount: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  rows: ContextMenuRow[];
};

function SplitSample({ idTag, palette, label, cardCount, open, onToggle, onClose, rows }: SplitSampleProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const splitClass = [
    'btn-icon-split',
    palette === 'brand' ? 'btn-icon-split--brand' : 'btn-icon-split--ghost'
  ].join(' ');

  return (
    <div className="sample sample-wide">
      <div className="id-tag">{idTag}</div>
      <div className={splitClass}>
        <button type="button" className="btn-icon-split__primary" aria-label={label}>
          <span className="btn-ds__icon arc-icon-folder-open" aria-hidden="true" />
          <span className="btn-ds__value">{label}</span>
          <span className="btn-ds__counter">{cardCount}</span>
        </button>
        <span className="btn-icon-split__sep" aria-hidden="true" />
        <button
          ref={anchorRef}
          type="button"
          className={`btn-icon-split__secondary${open ? ' is-active' : ''}`}
          aria-label="Переключение библиотек"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={onToggle}
        >
          <span className="btn-icon-split__chevron arc-icon-chevron" aria-hidden="true" />
        </button>
      </div>
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={onClose}
        rows={rows}
        ariaLabel="Переключение библиотек"
      />
    </div>
  );
}

/**
 * Button icon split: Brand Default + Ghost Default + ContextMenu.
 * Figma: ARC-2 / 2062:14857
 */
export default function UiKitButtonIconSplitDemo() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [activeId, setActiveId] = useState(STUB_LIBRARIES[0].id);

  const activeLibrary = STUB_LIBRARIES.find((lib) => lib.id === activeId) ?? STUB_LIBRARIES[0];

  useLayoutEffect(() => {
    if (scopeRef.current) void hydrateArcNavbarIcons(scopeRef.current);
  }, [activeId, openKey]);

  const rows = useMemo<ContextMenuRow[]>(() => {
    const libRows: ContextMenuRow[] = STUB_LIBRARIES.map((lib) => ({
      type: 'item' as const,
      key: lib.id,
      label: lib.name,
      iconClass: 'arc-icon-folder-open',
      counter: lib.cardCount,
      selected: lib.id === activeId,
      onSelect: () => setActiveId(lib.id)
    }));
    libRows.push({ type: 'separator', key: 'sep-create' });
    libRows.push({
      type: 'item',
      key: 'create-library',
      label: 'Создать новую библиотеку',
      iconClass: 'arc-icon-plus',
      onSelect: () => undefined
    });
    return libRows;
  }, [activeId]);

  return (
    <div ref={scopeRef} className="demo-row">
      <SplitSample
        idTag="EL-BTN-ICON-SPLIT-BRAND-DEFAULT"
        palette="brand"
        label={activeLibrary.name}
        cardCount={activeLibrary.cardCount}
        open={openKey === 'brand'}
        onToggle={() => setOpenKey((k) => (k === 'brand' ? null : 'brand'))}
        onClose={() => setOpenKey(null)}
        rows={rows}
      />
      <SplitSample
        idTag="EL-BTN-ICON-SPLIT-GHOST-DEFAULT"
        palette="ghost"
        label={activeLibrary.name}
        cardCount={activeLibrary.cardCount}
        open={openKey === 'ghost'}
        onToggle={() => setOpenKey((k) => (k === 'ghost' ? null : 'ghost'))}
        onClose={() => setOpenKey(null)}
        rows={rows}
      />
    </div>
  );
}
