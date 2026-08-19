import { useState } from 'react';
import DetailTemplateEditor from '../../../components/gallery/DetailTemplateEditor';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import { defaultDetailCardTemplate, templateFieldLabel } from '@arc-main-shared/detailCardTemplate';
import { wipeCustomFieldValues } from '../../../services/db';
import ConfirmModal from '../ConfirmModal';

const LABEL_DETAIL_TEMPLATE =
  'Поля блока «Детали» на карточке. Один шаблон для всех библиотек. Удаление своего поля стирает значения на карточках. Системные поля только убираются из шаблона.';

export default function SettingsDetailTemplatePanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;
  const [pendingDeleteFieldId, setPendingDeleteFieldId] = useState<string | null>(null);
  const template = prefs?.detailCardTemplate ?? defaultDetailCardTemplate();
  const pendingField = template.fields.find((field) => field.id === pendingDeleteFieldId);
  const pendingDeleteLabel = pendingField ? templateFieldLabel(pendingField) : 'поле';
  const pendingDeleteIsCustom = pendingField?.kind === 'custom';

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content arc-ui-kit-scope${ready ? ' is-prefs-ready' : ''}`} data-btn-size="m">
        <div className="arc-settings-desc-block">
          <p className="text-m arc-settings-desc-block__text">{LABEL_DETAIL_TEMPLATE}</p>
        </div>

        <SettingsSeparator />

        <div className="arc-ui-kit-scope" data-btn-size="m" data-input-size="m">
          <DetailTemplateEditor
            variant="settings"
            template={template}
            readOnly={disabled}
            onChange={(detailCardTemplate) => void update({ detailCardTemplate })}
            onRequestDelete={(fieldId) => setPendingDeleteFieldId(fieldId)}
          />
        </div>
      </div>
      {pendingDeleteFieldId ? (
        <ConfirmModal
          title="Удалить поле?"
          message={
            pendingDeleteIsCustom
              ? `Поле «${pendingDeleteLabel}» будет удалено из шаблона, а его значения сотрутся на всех карточках.`
              : `Поле «${pendingDeleteLabel}» будет убрано из шаблона. Данные на карточках сохранятся.`
          }
          confirmLabel="Удалить"
          confirmVariant="danger"
          onCancel={() => setPendingDeleteFieldId(null)}
          onConfirm={() => {
            const fieldId = pendingDeleteFieldId;
            setPendingDeleteFieldId(null);
            void (async () => {
              if (pendingDeleteIsCustom) await wipeCustomFieldValues(fieldId);
              const nextFields = template.fields.filter((field) => field.id !== fieldId);
              await update({ detailCardTemplate: { version: 1, fields: nextFields } });
            })();
          }}
        />
      ) : null}
    </div>
  );
}
