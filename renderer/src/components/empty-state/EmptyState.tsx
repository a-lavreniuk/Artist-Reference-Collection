import { useLayoutEffect, useRef } from 'react';
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
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  const variantClass = action.variant === 'brand' ? 'btn-brand' : 'btn-outline';
  const iconClass =
    action.iconClass ?? (action.variant === 'brand' ? 'arc-add-dropzone-plus-icon' : 'arc-icon-plus');
  return (
    <button
      type="button"
      className={`btn ${variantClass} btn-ds arc-empty-state__action`}
      onClick={action.onClick}
    >
      <span className="btn-ds__value">{action.label}</span>
      {action.variant === 'brand' ? <span className={`btn-ds__icon ${iconClass}`} aria-hidden="true" /> : null}
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
  onPrimaryAction,
  onSecondaryAction
}: Props) {
  const actionsRef = useRef<HTMLDivElement>(null);

  const primaryAction =
    primaryActionLabel && onPrimaryAction
      ? { label: primaryActionLabel, variant: primaryActionVariant, onClick: onPrimaryAction }
      : null;
  const secondaryAction =
    secondaryActionLabel && onSecondaryAction
      ? { label: secondaryActionLabel, variant: secondaryActionVariant, onClick: onSecondaryAction }
      : null;

  useLayoutEffect(() => {
    if (actionsRef.current) {
      void hydrateArcNavbarIcons(actionsRef.current);
    }
  }, [primaryActionLabel, secondaryActionLabel]);

  return (
    <div
      className={`arc-empty-state panel elevation-${elevation}${fill ? ' arc-empty-state--fill' : ''}${className ? ` ${className}` : ''}`}
      data-elevation={elevation}
    >
      <div className="arc-empty-state__text">
        <h1 className="h1 arc-empty-state__title">{title}</h1>
        <p className="typo-p-m arc-empty-state__subtitle">{subtitle}</p>
      </div>
      {primaryAction || secondaryAction ? (
        <div ref={actionsRef} className="arc-empty-state__actions arc-ui-kit-scope" data-btn-size="l">
          {primaryAction ? <EmptyStateActionButton action={primaryAction} /> : null}
          {secondaryAction ? <EmptyStateActionButton action={secondaryAction} /> : null}
        </div>
      ) : null}
    </div>
  );
}
