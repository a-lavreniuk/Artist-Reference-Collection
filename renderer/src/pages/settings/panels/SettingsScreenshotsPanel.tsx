import SettingsRadioInlineGroup from '../../../components/settings/SettingsRadioInlineGroup';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import SettingsToggleShortcutRow from '../../../components/settings/SettingsToggleShortcutRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import type { ScreenshotFormat } from '../../../services/appPreferences';
import { shortcutMenuLabel } from '../../../shortcuts/shortcutLabels';

const SCREENSHOT_SHORTCUT = shortcutMenuLabel('global.screenshot');

const FORMAT_OPTIONS: Array<{ value: ScreenshotFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' }
];

const LABEL_ENABLE = 'Включить скриншоты';
const LABEL_ASK_SAVE = 'Спрашивать куда сохранять';
const LABEL_PREFIX_NAME =
  'Добавлять в название карточки «screenshot» к снимкам экрана';
const LABEL_RETINA = 'Сохранять скриншоты в ×2 разрешении';

export default function SettingsScreenshotsPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content${ready ? ' is-prefs-ready' : ''}`}>
        <SettingsToggleShortcutRow
          label={LABEL_ENABLE}
          shortcut={SCREENSHOT_SHORTCUT}
          pressed={prefs?.screenshotsEnabled === true}
          disabled={disabled}
          onPressedChange={(screenshotsEnabled) => void update({ screenshotsEnabled })}
        />

        {prefs?.screenshotsEnabled ? (
          <>
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
                label={LABEL_PREFIX_NAME}
                pressed={prefs.screenshotPrefixName === true}
                disabled={disabled}
                onPressedChange={(screenshotPrefixName) => void update({ screenshotPrefixName })}
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
