import { useLayoutEffect, useRef } from 'react';
import ContextMenuHeader from '../../context-menu/ContextMenuHeader';
import ContextMenuSeparator from '../../context-menu/ContextMenuSeparator';
import type { SavedFilterPreset } from '../../gallery/galleryFilterTypes';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';
import FilterPresetMenuRow from './FilterPresetMenuRow';

type Props = {
  presets: SavedFilterPreset[];
  canSave: boolean;
  onApply: (preset: SavedFilterPreset) => void;
  onEdit: (preset: SavedFilterPreset) => void;
  onSave: () => void;
};

export default function FilterPresetsMenu({ presets, canSave, onApply, onEdit, onSave }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!listRef.current) return;
    void hydrateArcNavbarIcons(listRef.current);
  }, [presets, canSave]);

  return (
    <>
      <ContextMenuHeader>Сохранённые пресеты</ContextMenuHeader>
      <div ref={listRef} className="context-menu__preset-list arc-navbar-no-drag">
        {presets.map((preset) => (
          <FilterPresetMenuRow
            key={preset.id}
            name={preset.name}
            onApply={() => onApply(preset)}
            onEdit={() => onEdit(preset)}
          />
        ))}
        {presets.length > 0 ? <ContextMenuSeparator /> : null}
        <div className="context-menu__preset-row" role="presentation">
          <button
            type="button"
            role="menuitem"
            className={`context-menu__preset-save${canSave ? '' : ' is-disabled'}`}
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave();
            }}
          >
            <span className="context-menu__preset-save-inner">
              <span className="context-menu__preset-row-label">Сохранить пресет</span>
              <span
                className="context-menu__preset-row-edit-icon tab-icon arc-icon-plus"
                data-arc-icon-size="m"
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
