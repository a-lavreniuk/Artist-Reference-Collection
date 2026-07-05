type Props = {
  label: string;
  value: string;
};

/** Figma 1036:38665 — hardware row: label secondary, value primary */
export default function SettingsHardwareRow({ label, value }: Props) {
  return (
    <div className="arc-settings-hardware-row">
      <span className="arc-settings-hardware-row__label text-m" data-typo-role="secondary">
        {label}
      </span>
      <span className="arc-settings-hardware-row__value text-m">{value}</span>
    </div>
  );
}
