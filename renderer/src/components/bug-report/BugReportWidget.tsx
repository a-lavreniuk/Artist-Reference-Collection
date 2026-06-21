import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Tooltip } from '../tooltip/Tooltip';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { openBugReportForm } from '../../services/bugReportService';

export default function BugReportWidget() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [ready]);

  useLayoutEffect(() => {
    void (async () => {
      const url = await window.arc?.getBugReportFormUrl?.();
      setReady(typeof url === 'string' && url.length > 0);
    })();
  }, []);

  const handleClick = useCallback(() => {
    void openBugReportForm();
  }, []);

  if (!ready) return null;

  return createPortal(
    <div ref={rootRef} className="arc-bug-report-widget arc-ui-kit-scope" data-btn-size="l">
      <Tooltip content="Сообщить о проблеме" delay={500} position="left">
        <button
          type="button"
          className="btn btn-brand btn-ds btn-icon-only"
          aria-label="Сообщить о проблеме"
          onClick={handleClick}
        >
          <span className="btn-icon-only__glyph arc-icon-bug" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>,
    document.body
  );
}
