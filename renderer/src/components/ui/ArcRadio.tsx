type Props = {
  checked: boolean;
  className?: string;
};

/** Декоративный радиобаттон 16×16 (Figma Radio, node 808:3922). */
export default function ArcRadio({ checked, className = '' }: Props) {
  return (
    <span
      className={`arc-radio${checked ? ' arc-radio--checked' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <span className="arc-radio__ring" />
      <span className="arc-radio__dot" />
    </span>
  );
}
