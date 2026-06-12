type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function ContextMenuHeader({ children, className }: Props) {
  const rootClass = ['context-menu__header', 'text-s', className].filter(Boolean).join(' ');
  return (
    <p className={rootClass} role="presentation">
      {children}
    </p>
  );
}
