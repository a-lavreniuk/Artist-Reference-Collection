import SettingsRadioRow from '../../../components/settings/SettingsRadioRow';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import type { GalleryCollectionsSortMode } from '../../../services/appPreferences';

const LABEL_LAUNCH_AT_LOGIN = 'Запускать ARC при входе в систему.';
const LABEL_CLOSE_TO_TRAY = 'При закрытии окна сворачивать приложение, а не закрывать.';
const LABEL_TRASH_SOURCES =
  'Удалять исходные файлы после добавления их в систему и формирования карточки. Эти файлы будут перенесены в системную корзину.';
const LABEL_DELETE_TO_TRASH = 'Удаление карточек переносит их в корзину, а не удаляет из системы.';
const LABEL_GALLERY_COLLECTIONS_STRIP = 'Показывать коллекции на экране библиотеки';

const COLLECTIONS_SORT_OPTIONS: Array<{ value: GalleryCollectionsSortMode; label: string }> = [
  { value: 'chrono', label: 'По хронологии' },
  { value: 'count', label: 'По количеству карточек' },
  { value: 'random', label: 'Случайный порядок' }
];

export default function SettingsGeneralPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content${ready ? ' is-prefs-ready' : ''}`}>
        <SettingsSection title="Элементы запуска">
          <SettingsToggleRow
            label={LABEL_LAUNCH_AT_LOGIN}
            pressed={prefs?.launchAtLogin ?? false}
            disabled={disabled}
            onPressedChange={(launchAtLogin) => void update({ launchAtLogin })}
          />
          <SettingsToggleRow
            label={LABEL_CLOSE_TO_TRAY}
            pressed={prefs?.closeToTrayOnWindowClose === true}
            disabled={disabled}
            onPressedChange={(closeToTrayOnWindowClose) => void update({ closeToTrayOnWindowClose })}
          />
        </SettingsSection>

        <SettingsSeparator />

        <SettingsSection title="Поведение с файлами">
          <SettingsToggleRow
            label={LABEL_TRASH_SOURCES}
            pressed={prefs?.importSourceFilesAction === 'trash'}
            disabled={disabled}
            onPressedChange={(on) => void update({ importSourceFilesAction: on ? 'trash' : 'ask' })}
          />
          <SettingsToggleRow
            label={LABEL_DELETE_TO_TRASH}
            pressed={prefs?.deleteCardsUseTrash === true}
            disabled={disabled}
            onPressedChange={(deleteCardsUseTrash) => void update({ deleteCardsUseTrash })}
          />
        </SettingsSection>

        <SettingsSeparator />

        <SettingsSection title="Библиотека">
          <SettingsToggleRow
            label={LABEL_GALLERY_COLLECTIONS_STRIP}
            pressed={prefs?.galleryCollectionsStripEnabled !== false}
            disabled={disabled}
            onPressedChange={(galleryCollectionsStripEnabled) => void update({ galleryCollectionsStripEnabled })}
          />
          {prefs?.galleryCollectionsStripEnabled !== false ? (
            <div className="arc-settings-radio-stack" role="radiogroup" aria-label="Порядок коллекций на экране библиотеки">
              {COLLECTIONS_SORT_OPTIONS.map((option) => (
                <SettingsRadioRow
                  key={option.value}
                  label={option.label}
                  checked={(prefs.galleryCollectionsSortMode ?? 'chrono') === option.value}
                  disabled={disabled}
                  onCheckedChange={() => void update({ galleryCollectionsSortMode: option.value })}
                />
              ))}
            </div>
          ) : null}
        </SettingsSection>
      </div>
    </div>
  );
}
