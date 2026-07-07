/** Разделитель секций настроек (Figma Separator, node 1365:3971): линия 1px, отступ сверху и снизу --s-4. */
export default function SettingsSeparator({ className }: { className?: string }) {
  return (
    <hr
      className={className ? `arc-settings-separator ${className}` : 'arc-settings-separator'}
      role="separator"
    />
  );
}
