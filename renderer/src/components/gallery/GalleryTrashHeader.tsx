import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseLibraryScope } from '../../search/libraryScopeUrl';
import NavbarTrashActions from '../layout/NavbarTrashActions';
import { useGlobalTrashCardCount } from './useTrashScope';

/** Заголовок режима корзины над сеткой (Figma 2375:21005). */
export default function GalleryTrashHeader() {
  const [searchParams] = useSearchParams();
  const scope = parseLibraryScope(searchParams);
  const trashCount = useGlobalTrashCardCount();
  const [maintenanceLocked, setMaintenanceLocked] = useState(false);
  const visible = scope === 'trash' && trashCount > 0;

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v) => setMaintenanceLocked(v));
  }, []);

  if (!visible) return null;

  return (
    <div className="arc-gallery-trash-header arc-ui-kit-scope" data-btn-size="m">
      <div className="arc-gallery-trash-header__row">
        <div className="arc-gallery-trash-header__title">
          <h1 className="h1 arc-gallery-trash-header__label">Корзина</h1>
          <span className="h1 arc-gallery-trash-header__count">{trashCount}</span>
        </div>
        <NavbarTrashActions disabled={maintenanceLocked} />
      </div>
      <div className="context-menu__sep" role="separator" aria-hidden="true" />
    </div>
  );
}
