import SettingsRadioRow from './SettingsRadioRow';
import type { ScreenshotFormat } from '../../services/appPreferences';

type Option = {
  value: ScreenshotFormat;
  label: string;
};

type Props = {
  value: ScreenshotFormat;
  disabled?: boolean;
  options: Option[];
  onValueChange: (value: ScreenshotFormat) => void;
};

/** Горизонтальная группа radio (Figma 1036:33330, gap 16px). */
export default function SettingsRadioInlineGroup({ value, disabled = false, options, onValueChange }: Props) {
  return (
    <div className="arc-settings-radio-inline-group" role="radiogroup">
      {options.map((option) => (
        <SettingsRadioRow
          key={option.value}
          label={option.label}
          checked={value === option.value}
          disabled={disabled}
          onCheckedChange={() => onValueChange(option.value)}
        />
      ))}
    </div>
  );
}
