import type { ReactNode } from 'react';
import { Tooltip } from '../../../components/tooltip/Tooltip';

type Props = {
  detail: string;
  path?: string;
  children?: ReactNode;
};

export default function IntegrityIssueRow({ detail, path, children }: Props) {
  return (
    <div className="arc-integrity-row">
      <div className="arc-integrity-row__text">
        <p className="text-m arc-integrity-row__detail">{detail}</p>
        {path ? (
          <Tooltip content={path} delay={500} position="top" className="arc-integrity-row__path-tooltip">
            <p className="text-s arc-integrity-row__path">{path}</p>
          </Tooltip>
        ) : null}
      </div>
      {children ? <div className="arc-integrity-row__actions">{children}</div> : null}
    </div>
  );
}
