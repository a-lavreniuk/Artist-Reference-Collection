import { useRef } from 'react';
import { useIsTextTruncated } from '../../hooks/useIsTextTruncated';
import { Tooltip } from './Tooltip';

type Props = {
  text: string;
  className?: string;
  /** Классы на обёртку Tooltip (flex / min-width) */
  wrapClassName?: string;
};

/**
 * Текст с ellipsis и Tooltip с полным значением только при реальной обрезке.
 * Обёртка — `span` (можно внутри `<button>`).
 */
export function TruncatedTextWithTooltip({
  text,
  className,
  wrapClassName = 'arc-truncated-tooltip-wrap'
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const truncated = useIsTextTruncated(ref, text);

  return (
    <Tooltip
      as="span"
      content={truncated ? text : null}
      delay={500}
      position="top"
      className={wrapClassName}
    >
      <span ref={ref} className={className}>
        {text}
      </span>
    </Tooltip>
  );
}
