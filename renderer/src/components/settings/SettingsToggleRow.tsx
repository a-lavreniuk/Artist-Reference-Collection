import SettingsControlRow from './SettingsControlRow';

type Props = {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

export default function SettingsToggleRow({ label, pressed, disabled = false, onPressedChange }: Props) {
  return (
    <SettingsControlRow
      variant="toggle"
      label={label}
      checked={pressed}
      disabled={disabled}
      onCheckedChange={onPressedChange}
    />
  );
}
