import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEARCH_MODE_META, type NavbarSearchMode } from '../../../search/navbarSearchMode';
import { Tooltip } from '../../tooltip/Tooltip';

type NavbarSearchModesProps = {
  mode: NavbarSearchMode;
  aiModesReady: boolean;
  onModeChange: (mode: NavbarSearchMode) => void;
};

const MODES: NavbarSearchMode[] = ['tags', 'ai', 'color', 'similar'];
const AI_SETTINGS_PATH = '/settings/ai-search';

/** Figma 822:8875 — icon-tab M, без групповой рамки */
export default function NavbarSearchModes({
  mode,
  aiModesReady,
  onModeChange
}: NavbarSearchModesProps) {
  const navigate = useNavigate();

  return (
    <div
      className="tabs arc-navbar-search-modes"
      role="tablist"
      aria-label="Режим поиска"
      data-arc-icon-size="m"
      data-btn-size="m"
    >
      {MODES.map((item) => {
        const meta = SEARCH_MODE_META[item];
        const active = !unavailable && mode === item;
        const needsAi = item === 'ai' || item === 'similar';
        const unavailable = needsAi && !aiModesReady;
        const hint = unavailable ? (meta.unavailableHint ?? null) : null;
        const label = hint ?? meta.label;

        const button = (
          <button
            type="button"
            role="tab"
            className={`tab-button tab-icon-only${active ? ' is-active' : ''}`}
            aria-selected={active}
            aria-label={label}
            aria-disabled={unavailable || undefined}
            onClick={() => {
              if (unavailable) {
                navigate(AI_SETTINGS_PATH);
                return;
              }
              if (!meta.enabled) return;
              // Режим и URL обновляет handleModeChange; не вызываем writeNavbarSearchMode
              // заранее — иначе эффект sync по URL может откатить клик (особенно из «Цвет»).
              onModeChange(item);
            }}
          >
            <span className={`tab-icon ${meta.iconClass}`} data-arc-icon-size="m" aria-hidden="true" />
          </button>
        );

        if (!hint) {
          return <Fragment key={item}>{button}</Fragment>;
        }

        return (
          <Tooltip key={item} content={hint} delay={500} position="top" as="span">
            <span className="arc-tooltip-anchor-inline">{button}</span>
          </Tooltip>
        );
      })}
    </div>
  );
}
