import SettingsControlRow from './SettingsControlRow';

type Props = {
  label: string;
  toolId: string;
  pressed: boolean;
  disabled?: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

/** Toggle-строка инструмента MCP: подпись слева, id справа (как шорткат в настройках). */
export default function SettingsMcpToolRow({
  label,
  toolId,
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
      <span className="arc-settings-toggle-shortcut-row__hint hint" aria-hidden="true">
        {toolId}
      </span>
    </div>
  );
}
