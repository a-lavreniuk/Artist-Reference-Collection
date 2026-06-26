import { Loader } from '../../../loader';

type NavbarSearchBarActionsProps = {
  children: React.ReactNode;
};

export default function NavbarSearchBarActions({ children }: NavbarSearchBarActionsProps) {
  return <div className="arc-navbar-search-actions slot-trailing">{children}</div>;
}

export function NavbarSearchIconButton({
  ariaLabel,
  iconClass,
  className = 'arc-navbar-search-send-btn',
  onClick
}: {
  ariaLabel: string;
  iconClass: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`tab-button tab-icon-only ${className}`} aria-label={ariaLabel} onClick={onClick}>
      <span className={`tab-icon ${iconClass}`} aria-hidden="true" />
    </button>
  );
}

export function NavbarSearchLoader({ className = 'arc-navbar-search-send-btn' }: { className?: string }) {
  return (
    <span
      className={`tab-button tab-icon-only arc-navbar-search-loader-slot ${className}`}
      role="status"
      aria-label="Поиск"
    >
      <Loader decorative />
    </span>
  );
}
