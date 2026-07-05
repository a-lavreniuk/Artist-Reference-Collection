type Props = {
  label: string;
  shortcut: string;
};

/** Read-only shortcut row (Figma 1036:34148). */
export default function SettingsShortcutRow({ label, shortcut }: Props) {
  return (
    <div className="arc-settings-shortcut-row">
      <span className="arc-settings-shortcut-row__label text-m">{label}</span>
      <span className="arc-settings-shortcut-row__keys text-m">{shortcut}</span>
    </div>
  );
}
