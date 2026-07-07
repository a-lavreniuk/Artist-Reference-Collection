import './loader.css';

export type LoaderSize = 'inline' | 'm';

export type LoaderProps = {
  className?: string;
  size?: LoaderSize;
  /** When set, renders as live status region */
  label?: string;
  /** Hide from assistive tech when parent announces status */
  decorative?: boolean;
};

const SIZE_CLASS: Record<LoaderSize, string> = {
  inline: '',
  m: 'arc-loader-inline--m'
};

export function Loader({
  className = '',
  size = 'inline',
  label = 'Загрузка',
  decorative = false
}: LoaderProps) {
  const classes = ['loader', 'arc-loader-inline', SIZE_CLASS[size], className].filter(Boolean).join(' ');

  if (decorative) {
    return <span className={classes} aria-hidden="true" />;
  }

  return <span className={classes} role="status" aria-label={label} />;
}
