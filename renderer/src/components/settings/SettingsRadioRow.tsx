import SettingsControlRow from './SettingsControlRow';

type Props = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  labelSize?: 'm' | 's';
  onCheckedChange?: (checked: boolean) => void;
};

export default function SettingsRadioRow({
  label,
  checked,
  disabled = false,
  labelSize = 'm',
  onCheckedChange
}: Props) {
  return (
    <SettingsControlRow
      variant="radio"
      label={label}
      checked={checked}
      disabled={disabled}
      labelSize={labelSize}
      onCheckedChange={onCheckedChange}
    />
  );
}
