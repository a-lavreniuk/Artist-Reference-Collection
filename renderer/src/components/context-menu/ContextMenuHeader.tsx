type Props = {
  children: React.ReactNode;
};

export default function ContextMenuHeader({ children }: Props) {
  return (
    <p className="context-menu__header text-s" role="presentation">
      {children}
    </p>
  );
}
