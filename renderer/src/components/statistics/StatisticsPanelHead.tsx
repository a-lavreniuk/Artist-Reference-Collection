import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  icon: ReactNode;
  className?: string;
  iconClassName?: string;
};

/** Заголовок панели статистики: иконка справа; при ширине окна ≤1440px — сверху. */
export default function StatisticsPanelHead({ children, icon, className, iconClassName }: Props) {
  const hostClass = ['arc-stats-panel-head', className].filter(Boolean).join(' ');

  return (
    <div className={hostClass}>
      <div className="arc-stats-panel-head__content">{children}</div>
      <span className={['arc-stats-panel-head__icon', iconClassName].filter(Boolean).join(' ')}>{icon}</span>
    </div>
  );
}
