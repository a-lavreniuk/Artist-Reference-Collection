import { useEffect, type ReactNode } from 'react';
import OnboardingTopBar from './OnboardingTopBar';

type Props = {
  children: ReactNode;
  className?: string;
};

export default function OnboardingLayout({ children, className }: Props) {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    body.classList.add('arc-onboarding-page');
    html.classList.add('arc-onboarding-page');
    html.style.height = '100%';
    body.style.height = '100%';
    body.setAttribute('data-elevation', 'sunken');
    body.setAttribute('data-typo-tone', 'white');
    body.setAttribute('data-btn-size', 'm');
    body.setAttribute('data-arc-icon-size', 'm');
    return () => {
      html.style.height = '';
      body.style.height = '';
      body.classList.remove('arc-onboarding-page');
      html.classList.remove('arc-onboarding-page');
      body.removeAttribute('data-elevation');
      body.removeAttribute('data-typo-tone');
      body.removeAttribute('data-btn-size');
      body.removeAttribute('data-arc-icon-size');
    };
  }, []);

  return (
    <div className={`arc-onboarding-shell${className ? ` ${className}` : ''}`}>
      <OnboardingTopBar />
      <div className="arc-onboarding-shell__content">{children}</div>
    </div>
  );
}
