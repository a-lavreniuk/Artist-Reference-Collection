import { useCallback, useState } from 'react';

import ToastAlert from '../../../components/alert/ToastAlert';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';

const LABEL_ENABLE = 'Принимать изображения от расширения';
const HINT_INTRO =
  'Расширение «Save to ARC» отправляет изображения и видео с веб-страниц прямо в библиотеку, пока приложение запущено.';
const HINT_OFF = 'Пока приём выключен, ARC отклоняет запросы расширения. Файлы можно поставить в очередь в самом расширении.';
const HINT_INSTALL =
  'Установка: в адресной строке браузера откройте browser://extensions и загрузите папку browser-extension из репозитория.';
const HINT_SITES = 'Поддерживаются в том числе Pinterest, ArtStation и Instagram.';
const HINT_SITE_EXCEPTIONS =
  'Чтобы скрыть кнопку сохранения на отдельных сайтах, откройте popup расширения и добавьте сайт в исключения.';
const HINT_SECRET =
  'Локальный секрет (X-ARC-Local-Token) нужен расширению. Скопируйте его в настройки расширения.';

/** Настройки Import API для браузерного расширения */
export default function SettingsBrowserExtensionPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;
  const [copyAlertKey, setCopyAlertKey] = useState(0);
  const secret = prefs?.localApiSecret?.trim() ?? '';
  const importEnabled = prefs?.importApiEnabled === true;

  const copySecret = useCallback(async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyAlertKey((k) => k + 1);
    } catch {
      /* clipboard unavailable */
    }
  }, [secret]);

  const regenerateSecret = useCallback(() => {
    void update({ localApiSecret: '' });
  }, [update]);

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content arc-ui-kit-scope${ready ? ' is-prefs-ready' : ''}`} data-btn-size="m">
        <div className="arc-settings-desc-block">
          <p className="text-m arc-settings-desc-block__text">{HINT_INTRO}</p>
          <SettingsToggleRow
            label={LABEL_ENABLE}
            pressed={importEnabled}
            disabled={disabled}
            onPressedChange={(importApiEnabled) => void update({ importApiEnabled })}
          />
          {!importEnabled ? (
            <p className="text-m arc-settings-desc-block__text">{HINT_OFF}</p>
          ) : (
            <>
              <SettingsSeparator />
              <p className="text-m arc-settings-desc-block__text">{HINT_INSTALL}</p>
              <p className="text-m arc-settings-desc-block__text">{HINT_SITES}</p>
              <p className="text-m arc-settings-desc-block__text">{HINT_SITE_EXCEPTIONS}</p>
              <SettingsSeparator />
              <SettingsSection title="Секрет">
                <p className="text-m arc-settings-desc-block__text">{HINT_SECRET}</p>
                <p className="text-m arc-settings-desc-block__text">
                  Секрет:{' '}
                  <span className="text-code-m">{secret ? `${secret.slice(0, 8)}…` : '—'}</span>
                </p>
                <div className="btn-group btn-group-ds">
                  <button
                    type="button"
                    className="btn btn-outline btn-ds"
                    disabled={disabled || !secret}
                    onClick={() => void copySecret()}
                  >
                    <span className="btn-ds__value">Копировать секрет</span>
                  </button>
                  <button type="button" className="btn btn-ghost btn-ds" disabled={disabled} onClick={regenerateSecret}>
                    <span className="btn-ds__value">Сгенерировать новый</span>
                  </button>
                </div>
              </SettingsSection>
            </>
          )}
        </div>
      </div>
      {copyAlertKey > 0 ? (
        <ToastAlert
          key={copyAlertKey}
          message="Секрет скопирован"
          variant="success"
          autoDismissMs={2500}
          withSound={false}
          onClose={() => setCopyAlertKey(0)}
        />
      ) : null}
    </div>
  );
}
