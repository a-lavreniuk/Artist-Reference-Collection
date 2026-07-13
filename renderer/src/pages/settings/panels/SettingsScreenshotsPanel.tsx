import SettingsRadioInlineGroup from '../../../components/settings/SettingsRadioInlineGroup';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsShortcutRow from '../../../components/settings/SettingsShortcutRow';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import type { ScreenshotFormat } from '../../../services/appPreferences';
import { shortcutDisplayLabel } from '../../../shortcuts/shortcutLabels';

const FORMAT_OPTIONS: Array<{ value: ScreenshotFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' }
];

const LABEL_ENABLE = 'Включить скриншоты';
const LABEL_ASK_SAVE = 'Спрашивать куда сохранять';
const LABEL_RETINA = 'Сохранять скриншоты в ×2 разрешении';

const SCREENSHOT_SHORTCUT_ROWS = [
  { label: 'Скриншот области', shortcut: shortcutDisplayLabel('global.screenshot.area') },
  { label: 'Скриншот экрана', shortcut: shortcutDisplayLabel('global.screenshot.fullscreen') },
  { label: 'Скриншот окна', shortcut: shortcutDisplayLabel('global.screenshot.window') }
] as const;

export default function SettingsScreenshotsPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content${ready ? ' is-prefs-ready' : ''}`}>
        <SettingsToggleRow
          label={LABEL_ENABLE}
          pressed={prefs?.screenshotsEnabled === true}
          disabled={disabled}
          onPressedChange={(screenshotsEnabled) => void update({ screenshotsEnabled })}
        />

        {prefs?.screenshotsEnabled ? (
          <>
            <SettingsSeparator />

            <SettingsSection title="Горячие клавиши">
              {SCREENSHOT_SHORTCUT_ROWS.map((row) => (
                <SettingsShortcutRow key={row.label} label={row.label} shortcut={row.shortcut} />
              ))}
            </SettingsSection>

            <SettingsSeparator />

            <SettingsSection title="Формат файла">
              <SettingsRadioInlineGroup
                value={prefs.screenshotFormat ?? 'webp'}
                disabled={disabled}
                options={FORMAT_OPTIONS}
                onValueChange={(screenshotFormat) => void update({ screenshotFormat })}
              />
            </SettingsSection>

            <SettingsSeparator />

            <SettingsSection title="Настройки">
              <SettingsToggleRow
                label={LABEL_ASK_SAVE}
                pressed={prefs.screenshotAskSaveLocation === true}
                disabled={disabled}
                onPressedChange={(screenshotAskSaveLocation) => void update({ screenshotAskSaveLocation })}
              />
              <SettingsToggleRow
                label={LABEL_RETINA}
                pressed={prefs.screenshotRetina2x === true}
                disabled={disabled}
                onPressedChange={(screenshotRetina2x) => void update({ screenshotRetina2x })}
              />
            </SettingsSection>
          </>
        ) : null}
      </div>
    </div>
  );
}
