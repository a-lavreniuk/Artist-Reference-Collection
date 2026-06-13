import SettingsControlRow from './SettingsControlRow';

type Props = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export default function SettingsRadioRow({ label, checked, disabled = false, onCheckedChange }: Props) {
  return (
    <SettingsControlRow
      variant="radio"
      label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  );
}
