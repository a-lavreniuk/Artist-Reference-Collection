import { useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** Search field — UI-Kit EL-INP-GROUP-SEARCH (arcUiKitMain.html), Figma 1036:34145, size M. */
export default function SettingsShortcutsSearch({
  value,
  onChange,
  placeholder = 'Поиск'
}: Props) {
  const hostRef = useRef<HTMLLabelElement>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (el) void hydrateArcNavbarIcons(el);
  });

  return (
    <label
      ref={hostRef}
      className={`field search-live arc-settings-shortcuts-search${value.length > 0 ? ' has-value' : ''}`}
      data-live-search
    >
      <div className="input search-field input-slots">
        <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
        <input
          type="text"
          className="search-inner slot-value"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          className="input-inline-icon search-clear-btn input-inline-icon--close arc-icon-close slot-trailing"
          aria-label="Очистить поиск"
          onClick={() => onChange('')}
        />
      </div>
    </label>
  );
}
