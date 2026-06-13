import { useLocation, useNavigate } from 'react-router-dom';

type Props = {
  to: string;
  label: string;
  iconClass: string;
};

export default function SettingsSidebarNavItem({ to, label, iconClass }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu__item${isActive ? ' is-active' : ''}`}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => navigate(to)}
    >
      <span className="context-menu__item-inner">
        <span className="context-menu__item-label-cluster">
          <span className={`context-menu__item-icon tab-icon ${iconClass}`} data-arc-icon-size="s" aria-hidden="true" />
          <span className="context-menu__item-label">{label}</span>
        </span>
        {isActive ? <span className="sr-only"> (текущий раздел)</span> : null}
      </span>
    </button>
  );
}
