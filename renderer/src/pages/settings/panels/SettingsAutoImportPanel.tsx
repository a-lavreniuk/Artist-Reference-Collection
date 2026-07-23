import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';

import { useSettingsArcHint } from '../hooks/useSettingsArcHint';

import { useSettingsAutoImport } from '../hooks/useSettingsAutoImport';



const LABEL_DESCRIPTION =

  'Укажите папку на диске — ARC будет отслеживать её и автоматически добавлять новые изображения и видео в библиотеку в раздел «Без категории».';

const LABEL_TOGGLE = 'Включить автоимпорт';

const LABEL_TRASH_SOURCES = 'Очищать папку после добавления файлов в систему.';



/** Figma 1036:36778 (OFF) / 1036:36990 (ON) — Автоимпорт */

export default function SettingsAutoImportPanel() {

  const arcHint = useSettingsArcHint();

  const {

    disabled,

    controlsDisabled,

    enabled,

    folderPath,

    trashSourcesEnabled,
    activeLibraryName,

    setEnabled,

    chooseFolder,

    setTrashSourcesEnabled

  } = useSettingsAutoImport();



  return (

    <div className="arc-settings-main__scroll">

      <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">

        <div className="arc-settings-desc-block">

          <p className="text-m arc-settings-desc-block__text">{LABEL_DESCRIPTION}</p>
          {activeLibraryName ? (
            <p className="text-s hint">Настройки для библиотеки «{activeLibraryName}»</p>
          ) : null}

          <SettingsToggleRow

            label={LABEL_TOGGLE}

            pressed={enabled}

            disabled={disabled}

            onPressedChange={(pressed) => void setEnabled(pressed)}

          />

          {enabled ? (

            <>

              <div className="arc-settings-auto-import__folder">

                <div className="arc-settings-action-row">

                  <button

                    type="button"

                    className="btn btn-secondary btn-ds"

                    onClick={() => void chooseFolder()}

                    disabled={disabled}

                  >

                    <span className="btn-ds__value">Выбрать папку</span>

                  </button>

                  <span className="text-m arc-settings-action-row__meta" title={folderPath ?? undefined}>

                    {folderPath ?? 'Не выбрана'}

                  </span>

                </div>

              </div>

              <div className="arc-settings-auto-import__sources">

                <SettingsToggleRow

                  label={LABEL_TRASH_SOURCES}

                  pressed={trashSourcesEnabled}

                  disabled={controlsDisabled}

                  onPressedChange={(on) => void setTrashSourcesEnabled(on)}

                />

              </div>

            </>

          ) : null}

          {!window.arc && arcHint ? (

            <div className="hint arc-settings-electron-hint">{arcHint}</div>

          ) : null}

        </div>

      </div>

    </div>

  );

}

