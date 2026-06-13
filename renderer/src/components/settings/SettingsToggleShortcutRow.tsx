import SettingsControlRow from './SettingsControlRow';

type Props = {
  label: string;
  shortcut: string;
  pressed: boolean;
  disabled?: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

/** Toggle-строка с подписью шортката справа (Figma 1036:33324). */
export default function SettingsToggleShortcutRow({
  label,
  shortcut,
  pressed,
  disabled = false,
  onPressedChange
}: Props) {
  return (
    <div className="arc-settings-toggle-shortcut-row">
      <SettingsControlRow
        variant="toggle"
        label={label}
        checked={pressed}
        disabled={disabled}
        onCheckedChange={onPressedChange}
      />
      <span className="arc-settings-toggle-shortcut-row__hint typo-p-m" aria-hidden="true">
        {shortcut}
      </span>
    </div>
  );
}
