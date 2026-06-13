import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';

const LABEL_SCREENSHOT = 'Сообщать, что добавлен скриншот';
const LABEL_DUPLICATES = 'Сообщать, что найдены дубликаты файлов';
const LABEL_AUTO_IMPORT = 'Сообщать, что сработал автоимпорт';
const LABEL_FILES_ADDED = 'Сообщать, что файлы добавлены в библиотеку';
const LABEL_SOUND = 'Звуковые оповещения';

export default function SettingsNotificationsPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content arc-settings-notifications-list${ready ? ' is-prefs-ready' : ''}`}>
        <SettingsToggleRow
          label={LABEL_SCREENSHOT}
          pressed={prefs?.notifyScreenshotSaved === true}
          disabled={disabled}
          onPressedChange={(notifyScreenshotSaved) => void update({ notifyScreenshotSaved })}
        />
        <SettingsToggleRow
          label={LABEL_DUPLICATES}
          pressed={prefs?.notifyDuplicatesFound === true}
          disabled={disabled}
          onPressedChange={(notifyDuplicatesFound) => void update({ notifyDuplicatesFound })}
        />
        <SettingsToggleRow
          label={LABEL_AUTO_IMPORT}
          pressed={prefs?.notifyAutoImport === true}
          disabled={disabled}
          onPressedChange={(notifyAutoImport) => void update({ notifyAutoImport })}
        />
        <SettingsToggleRow
          label={LABEL_FILES_ADDED}
          pressed={prefs?.notifyFilesAdded === true}
          disabled={disabled}
          onPressedChange={(notifyFilesAdded) => void update({ notifyFilesAdded })}
        />
        <SettingsToggleRow
          label={LABEL_SOUND}
          pressed={prefs?.notifySoundEnabled === true}
          disabled={disabled}
          onPressedChange={(notifySoundEnabled) => void update({ notifySoundEnabled })}
        />
      </div>
    </div>
  );
}
