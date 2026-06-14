type Props = {
  label: string;
  value: string;
};

/** Figma 1036:38665 — hardware row: label secondary, value primary */
export default function SettingsHardwareRow({ label, value }: Props) {
  return (
    <div className="arc-settings-hardware-row">
      <span className="arc-settings-hardware-row__label typo-p-m" data-typo-role="secondary">
        {label}
      </span>
      <span className="arc-settings-hardware-row__value typo-p-m">{value}</span>
    </div>
  );
}
