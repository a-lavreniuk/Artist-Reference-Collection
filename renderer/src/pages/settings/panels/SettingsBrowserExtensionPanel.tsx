import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import { ARC_IMPORT_API_PORT } from '../../../importApi/constants';

const LABEL_ENABLE = 'Разрешить импорт из расширения браузера';
const LABEL_PREFIX_ENABLE = 'Добавлять префикс к названию карточки';
const HINT_INTRO =
  'Chrome-расширение Save to ARC отправляет изображения на локальный API приложения. Установите unpacked-расширение из папки browser-extension в репозитории.';
const HINT_PORT = `API: http://127.0.0.1:${ARC_IMPORT_API_PORT}/api/v1/`;

/** Настройки Import API для браузерного расширения */
export default function SettingsBrowserExtensionPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content${ready ? ' is-prefs-ready' : ''}`}>
        <p className="typo-p-m arc-settings-browser-ext__hint" data-typo-role="secondary">
          {HINT_INTRO}
        </p>
        <p className="typo-p-m arc-settings-browser-ext__hint" data-typo-role="secondary">
          {HINT_PORT}
        </p>

        <SettingsSeparator />

        <SettingsToggleRow
          label={LABEL_ENABLE}
          pressed={prefs?.importApiEnabled === true}
          disabled={disabled}
          onPressedChange={(importApiEnabled) => void update({ importApiEnabled })}
        />

        {prefs?.importApiEnabled ? (
          <>
            <SettingsSeparator />

            <SettingsSection title="Название карточки">
              <SettingsToggleRow
                label={LABEL_PREFIX_ENABLE}
                pressed={prefs.importApiPrefixEnabled === true}
                disabled={disabled}
                onPressedChange={(importApiPrefixEnabled) => void update({ importApiPrefixEnabled })}
              />
              {prefs.importApiPrefixEnabled ? (
                <label className="field input-live arc-settings-browser-ext__prefix">
                  <span className="typo-p-s" data-typo-role="secondary">
                    Префикс
                  </span>
                  <input
                    type="text"
                    className="input-ds"
                    value={prefs.importApiPrefixText ?? ''}
                    maxLength={64}
                    disabled={disabled}
                    placeholder="web"
                    onChange={(e) => void update({ importApiPrefixText: e.target.value })}
                  />
                </label>
              ) : null}
            </SettingsSection>
          </>
        ) : null}
      </div>
    </div>
  );
}
