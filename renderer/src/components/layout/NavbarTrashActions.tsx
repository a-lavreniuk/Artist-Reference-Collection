import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConfirmEmptyTrashModal from './ConfirmEmptyTrashModal';
import { Tooltip } from '../tooltip/Tooltip';
import { useGlobalTrashCardCount } from '../gallery/useTrashScope';
import { emptyTrash } from '../../services/db';
import { showAppNotification } from '../../services/notificationService';
import { parseLibraryScope } from '../../search/libraryScopeUrl';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

const LABEL = 'Очистить корзину';

/** Ниже этой ширины подпись прячется и кнопка становится icon-only с тултипом. */
const COMPACT_MEDIA_QUERY = '(max-width: 1200px)';

function useCompactNavbar(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(COMPACT_MEDIA_QUERY).matches === true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(COMPACT_MEDIA_QUERY);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}

type Props = {
  disabled?: boolean;
};

/** «Очистить корзину» в правом островке навбара — только в режиме корзины. */
export default function NavbarTrashActions({ disabled = false }: Props) {
  const [searchParams] = useSearchParams();
  const scope = parseLibraryScope(searchParams);
  const trashCount = useGlobalTrashCardCount();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const compact = useCompactNavbar();
  const scopeRef = useRef<HTMLSpanElement>(null);
  const visible = scope === 'trash' && trashCount > 0;

  useEffect(() => {
    if (!visible) setConfirmOpen(false);
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible) return;
    const el = scopeRef.current;
    if (el) void hydrateArcNavbarIcons(el);
  }, [visible, compact]);

  if (!visible) return null;

  const button = (
    <button
      type="button"
      className={`btn btn-ghost btn-ds btn-m${compact ? ' btn-icon-only' : ''}`}
      aria-label={LABEL}
      disabled={disabled}
      onClick={() => setConfirmOpen(true)}
    >
      <span
        className={`${compact ? 'btn-icon-only__glyph' : 'btn-ds__icon'} arc-icon-broom`}
        aria-hidden="true"
      />
      {compact ? null : <span className="btn-ds__value">{LABEL}</span>}
    </button>
  );

  return (
    <>
      <span ref={scopeRef} className="arc-navbar-island-action">
        {compact ? (
          <Tooltip content={LABEL} position="bottom">
            {button}
          </Tooltip>
        ) : (
          button
        )}
      </span>
      {confirmOpen ? (
        <ConfirmEmptyTrashModal
          onClose={() => setConfirmOpen(false)}
          onConfirm={async () => {
            await emptyTrash();
            showAppNotification({
              message: 'Корзина очищена',
              variant: 'success',
              skipPrefCheck: true
            });
          }}
        />
      ) : null}
    </>
  );
}
