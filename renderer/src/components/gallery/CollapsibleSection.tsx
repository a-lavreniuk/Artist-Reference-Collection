import { useId, useState, type ReactNode } from 'react';
import { Tooltip } from '../tooltip/Tooltip';

type Props = {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export default function CollapsibleSection({ title, count, defaultOpen = true, children, footer }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headId = useId();

  return (
    <section className="arc-card-detail-section" aria-labelledby={headId}>
      <div className="arc-card-detail-section-head" id={headId}>
        <div className="arc-card-detail-section-label">
          <p className="text-l">{title}</p>
          {count !== undefined ? <span className="text-s arc-card-detail-section-count">{count}</span> : null}
        </div>
        <Tooltip content={open ? 'Свернуть' : 'Развернуть'} position="top">
          <span className="arc-card-detail-section-toggle-scope arc-ui-kit-scope" data-btn-size="s">
            <button
              type="button"
              className="btn btn-ghost btn-icon-only btn-ds arc-card-detail-section-toggle"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
            >
              <span
                className={`btn-icon-only__glyph arc-icon-chevron arc-card-detail-section-chevron${open ? ' is-open' : ''}`}
                aria-hidden="true"
              />
            </button>
          </span>
        </Tooltip>
      </div>
      {open ? (
        <div id={panelId} className="arc-card-detail-section-body">
          {children}
          {footer ? <div className="arc-card-detail-section-footer">{footer}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
