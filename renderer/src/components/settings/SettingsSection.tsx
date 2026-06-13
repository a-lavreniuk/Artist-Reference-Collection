import type { ReactNode } from 'react';

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export default function SettingsSection({ title, children, className = '' }: Props) {
  return (
    <section className={`arc-settings-section${className ? ` ${className}` : ''}`}>
      <h3 className="arc-settings-section__title typo-p-s">{title}</h3>
      <div className="arc-settings-section__body">{children}</div>
    </section>
  );
}
