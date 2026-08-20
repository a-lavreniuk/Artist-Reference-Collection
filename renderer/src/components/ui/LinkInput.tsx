import { useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import { hostDraftToStoredValue, parseLinkInput } from '../../utils/linkInput';

const PLACEHOLDER = 'example.com';

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  onOpen?: () => void;
  canOpen?: boolean;
  placeholder?: string;
};

export default function LinkInput({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  onOpen,
  canOpen = false,
  placeholder = PLACEHOLDER
}: Props) {
  const fieldRef = useRef<HTMLLabelElement>(null);
  const parsed = parseLinkInput(value);
  const filled = Boolean(parsed.host);

  useLayoutEffect(() => {
    if (fieldRef.current) void hydrateArcNavbarIcons(fieldRef.current);
  }, [filled, disabled]);

  return (
    <label
      ref={fieldRef}
      className={`field${filled ? ' has-value' : ''}`}
    >
      <div
        className={`input link-input input-slots${filled ? ' has-value' : ''}${disabled ? ' is-disabled' : ''}`}
      >
        <span className="link-prepend slot-prepend">{parsed.protocol}</span>
        <input
          className="link-value slot-value"
          type="text"
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={parsed.host}
          disabled={disabled}
          onChange={(e) => onChange(hostDraftToStoredValue(parsed.protocol, e.target.value))}
        />
        <span className="link-actions slot-trailing">
          {disabled ? (
            <span className="input-inline-icon link-lock arc-icon-lock" aria-hidden="true" />
          ) : filled ? (
            <>
              <button
                className="input-inline-icon input-clear-btn input-inline-icon--close arc-icon-close"
                type="button"
                aria-label={ariaLabel ? `Очистить ${ariaLabel}` : 'Очистить'}
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  onChange('');
                }}
              />
              {onOpen ? (
                <Tooltip content="Открыть ссылку" position="top" as="span">
                  <button
                    type="button"
                    className="input-inline-icon link-open-btn arc-icon-external-link"
                    aria-label="Открыть ссылку"
                    disabled={!canOpen}
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      onOpen();
                    }}
                  />
                </Tooltip>
              ) : (
                <span className="input-inline-icon link-open-btn arc-icon-external-link" aria-hidden="true" />
              )}
            </>
          ) : null}
        </span>
      </div>
    </label>
  );
}
