import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import { useAccordionMotion } from '../../motion';

type Props = {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
  footer
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  const toggleOpen = () => {
    const next = !open;
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const panelId = useId();
  const headId = useId();
  const toggleScopeRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useAccordionMotion(open, bodyRef);

  useLayoutEffect(() => {
    if (toggleScopeRef.current) void hydrateArcNavbarIcons(toggleScopeRef.current);
  }, [open]);

  return (
    <section className="arc-card-detail-section" aria-labelledby={headId}>
      <div className="arc-card-detail-section-head" id={headId}>
        <div className="arc-card-detail-section-label">
          <p className="text-l">{title}</p>
          {count !== undefined ? <span className="text-s arc-card-detail-section-count">{count}</span> : null}
        </div>
        <Tooltip content={open ? 'Свернуть' : 'Развернуть'} position="top">
          <span
            ref={toggleScopeRef}
            className="arc-card-detail-section-toggle-scope arc-ui-kit-scope"
            data-btn-size="s"
          >
            <button
              type="button"
              className="btn btn-outline btn-icon-only btn-ds arc-card-detail-section-toggle"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={toggleOpen}
            >
              <span
                className={`btn-icon-only__glyph ${open ? 'arc-icon-chevron-peak' : 'arc-icon-chevron-bottom'}`}
                aria-hidden="true"
              />
            </button>
          </span>
        </Tooltip>
      </div>
      <div
        id={panelId}
        ref={bodyRef}
        className="arc-card-detail-section-body"
        style={open ? undefined : { height: 0, overflow: 'hidden', opacity: 0 }}
        aria-hidden={!open}
      >
        {children}
        {footer ? <div className="arc-card-detail-section-footer">{footer}</div> : null}
      </div>
    </section>
  );
}
