import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { EmptyStateCopy } from '../../content/emptyStates';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

export type EmptyStateAction = {
  label: string;
  variant: 'brand' | 'outline';
  iconClass?: string;
  onClick: () => void;
};

type Props = EmptyStateCopy & {
  className?: string;
  elevation?: 'default' | 'sunken';
  fill?: boolean;
  /** Без собственного H1 и рамки: текст + ссылка в одной фразе. */
  layout?: 'default' | 'inline';
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  /** Иконка brand-кнопки (по умолчанию `arc-icon-plus`). */
  primaryActionIconClass?: string;
  /** Иконка outline-кнопки; без значения иконки нет. */
  secondaryActionIconClass?: string;
  children?: ReactNode;
};

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  const variantClass = action.variant === 'brand' ? 'btn-brand' : 'btn-outline';
  /* Inline SVG (hydrate), не CSS-mask: у stroke-иконок с рамкой mask даёт разрывы. */
  const iconClass = action.iconClass ?? (action.variant === 'brand' ? 'arc-icon-plus' : undefined);
  return (
    <button
      type="button"
      className={`btn ${variantClass} btn-ds arc-empty-state__action`}
      onClick={action.onClick}
    >
      <span className="btn-ds__value">{action.label}</span>
      {iconClass ? <span className={`btn-ds__icon ${iconClass}`} aria-hidden="true" /> : null}
    </button>
  );
}

export default function EmptyState({
  title,
  subtitle,
  primaryActionLabel,
  primaryActionVariant = 'brand',
  secondaryActionLabel,
  secondaryActionVariant = 'outline',
  className = '',
  elevation = 'default',
  fill = false,
  layout = 'default',
  onPrimaryAction,
  onSecondaryAction,
  primaryActionIconClass,
  secondaryActionIconClass,
  children
}: Props) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const inline = layout === 'inline';

  const primaryAction =
    primaryActionLabel && onPrimaryAction
      ? {
          label: primaryActionLabel,
          variant: primaryActionVariant,
          iconClass: primaryActionIconClass,
          onClick: onPrimaryAction
        }
      : null;
  const secondaryAction =
    secondaryActionLabel && onSecondaryAction
      ? {
          label: secondaryActionLabel,
          variant: secondaryActionVariant,
          iconClass: secondaryActionIconClass,
          onClick: onSecondaryAction
        }
      : null;

  useLayoutEffect(() => {
    if (inline || !actionsRef.current) return;
    void hydrateArcNavbarIcons(actionsRef.current);
  }, [inline, primaryActionLabel, secondaryActionLabel, primaryActionIconClass, secondaryActionIconClass]);

  if (inline) {
    return (
      <div
        className={`arc-empty-state arc-empty-state--inline${fill ? ' arc-empty-state--fill' : ''}${className ? ` ${className}` : ''}`}
      >
        <p className="text-m arc-empty-state__inline-copy">
          {subtitle}
          {primaryAction ? (
            <>
              {' '}
              <button type="button" className="inline-link" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </button>
            </>
          ) : null}
        </p>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`arc-empty-state panel elevation-${elevation}${fill ? ' arc-empty-state--fill' : ''}${className ? ` ${className}` : ''}`}
      data-elevation={elevation}
    >
      <div className="arc-empty-state__text">
        <h1 className="h1 arc-empty-state__title">{title}</h1>
        <p className="text-m arc-empty-state__subtitle">{subtitle}</p>
      </div>
      {primaryAction || secondaryAction ? (
        <div ref={actionsRef} className="arc-empty-state__actions arc-ui-kit-scope" data-btn-size="l">
          {primaryAction ? <EmptyStateActionButton action={primaryAction} /> : null}
          {secondaryAction ? <EmptyStateActionButton action={secondaryAction} /> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
