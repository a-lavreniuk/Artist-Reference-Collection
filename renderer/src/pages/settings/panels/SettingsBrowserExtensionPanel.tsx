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

/** Настройки Import API для браузерного расширения */
export default function SettingsBrowserExtensionPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

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
        </div>
      </div>
    </div>
  );
}
