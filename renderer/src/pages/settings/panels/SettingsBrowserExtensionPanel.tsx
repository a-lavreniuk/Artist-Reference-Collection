import { useCallback, useState } from 'react';

import ToastAlert from '../../../components/alert/ToastAlert';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';

const LABEL_ENABLE = 'Принимать изображения от расширения';
const HINT_INTRO =
  'Расширение для браузера «Save to ARC» отправляет изображения прямо в библиотеку.';
const HINT_INSTALL =
  'Для того чтобы установить расширение, в поисковой строке браузера введите команду browser://extensions и выберите папку browser-extension в репозитории.';
const HINT_SITES =
  'Расширение сохраняет в библиотеку изображения и видео с веб-страниц, в том числе с Pinterest, ArtStation и Instagram.';
const HINT_TOGGLE =
  'Когда приём включён, расширение сохраняет изображения с сайтов в библиотеку, пока ARC запущен. Когда выключен — ARC отклоняет такие запросы, и расширение предложит поставить их в очередь или покажет, что приём отключён.';
const HINT_SECRET =
  'Локальный секрет (X-ARC-Local-Token) нужен расширению и MCP. Скопируйте его в настройки расширения. Тот же секрет используется для MCP.';

/** Настройки Import API для браузерного расширения */
export default function SettingsBrowserExtensionPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;
  const [copyAlertKey, setCopyAlertKey] = useState(0);
  const secret = prefs?.localApiSecret?.trim() ?? '';

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
    // Empty string tells main to generate a new secret.
    void update({ localApiSecret: '' });
  }, [update]);

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content arc-ui-kit-scope${ready ? ' is-prefs-ready' : ''}`} data-btn-size="m">
        <div className="arc-settings-desc-block">
          <p className="text-m arc-settings-desc-block__text">{HINT_INTRO}</p>
          <p className="text-m arc-settings-desc-block__text">{HINT_INSTALL}</p>
          <p className="text-m arc-settings-desc-block__text">{HINT_SITES}</p>
          <p className="text-m arc-settings-desc-block__text">{HINT_TOGGLE}</p>
          <SettingsToggleRow
            label={LABEL_ENABLE}
            pressed={prefs?.importApiEnabled === true}
            disabled={disabled}
            onPressedChange={(importApiEnabled) => void update({ importApiEnabled })}
          />
          <p className="text-m arc-settings-desc-block__text">{HINT_SECRET}</p>
          <p className="text-m arc-settings-desc-block__text">
            Секрет:{' '}
            <span className="text-code-m">{secret ? `${secret.slice(0, 8)}…` : '—'}</span>
          </p>
          <div className="btn-group btn-group-ds">
            <button type="button" className="btn btn-outline btn-ds" disabled={disabled || !secret} onClick={() => void copySecret()}>
              <span className="btn-ds__value">Копировать секрет</span>
            </button>
            <button type="button" className="btn btn-ghost btn-ds" disabled={disabled} onClick={regenerateSecret}>
              <span className="btn-ds__value">Сгенерировать новый</span>
            </button>
          </div>
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
