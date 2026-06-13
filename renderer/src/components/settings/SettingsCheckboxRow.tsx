import SettingsControlRow from './SettingsControlRow';

type Props = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export default function SettingsCheckboxRow({ label, checked, disabled = false, onCheckedChange }: Props) {
  return (
    <SettingsControlRow
      variant="checkbox"
      label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  );
}
