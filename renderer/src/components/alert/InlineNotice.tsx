import { useRef, type ReactNode } from 'react';
import type { AlertVariant } from './types';
import { useInlineNoticeMotion } from '../../motion';

type Props = {
  variant: AlertVariant;
  title: string;
  body?: string;
  actions?: ReactNode;
  className?: string;
};

/** Inline-блок статуса в потоке страницы (без auto-dismiss и без крестика). */
export default function InlineNotice({ variant, title, body, actions, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useInlineNoticeMotion(rootRef);

  const rootClass = ['alert', `alert-${variant}`, 'arc-inline-notice', className].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={rootClass} role="status">
      <div className="arc-inline-notice__copy">
        <p className="text-m arc-inline-notice__title">{title}</p>
        {body ? <p className="text-m arc-inline-notice__body">{body}</p> : null}
      </div>
      {actions ? <div className="arc-inline-notice__actions">{actions}</div> : null}
    </div>
  );
}
