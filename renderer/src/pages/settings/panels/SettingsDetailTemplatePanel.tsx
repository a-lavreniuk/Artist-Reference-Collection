import { useState } from 'react';
import DetailTemplateEditor from '../../../components/gallery/DetailTemplateEditor';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import { useLibrarySettings } from '../../../hooks/useLibrarySettings';
import {
  applyDetailFieldType,
  CUSTOM_FIELD_TYPE_LABELS,
  templateFieldLabel,
  type CustomFieldType
} from '@arc-main-shared/detailCardTemplate';
import { wipeCustomFieldValues } from '../../../services/db';
import ConfirmModal from '../ConfirmModal';

const LABEL_DETAIL_TEMPLATE =
  'Поля блока «Детали» на карточке. Шаблон действует только в открытой библиотеке. Удаление поля или смена типа стирает значения на карточках этой библиотеки.';

type PendingAction =
  | { kind: 'delete'; fieldId: string }
  | { kind: 'type'; fieldId: string; type: CustomFieldType };

export default function SettingsDetailTemplatePanel() {
  const { template, ready, update } = useLibrarySettings();
  const disabled = !ready;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const pendingField = pending
    ? template.fields.find((field) => field.id === pending.fieldId)
    : undefined;
  const pendingLabel = pendingField ? templateFieldLabel(pendingField) : 'поле';

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
            onRequestDelete={(fieldId) => setPending({ kind: 'delete', fieldId })}
            onRequestTypeChange={(fieldId, type) => setPending({ kind: 'type', fieldId, type })}
          />
        </div>
      </div>
      {pending?.kind === 'delete' ? (
        <ConfirmModal
          title="Удалить поле?"
          message={`Поле «${pendingLabel}» будет удалено из шаблона, а его значения сотрутся на всех карточках этой библиотеки.`}
          confirmLabel="Удалить"
          confirmVariant="danger"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const fieldId = pending.fieldId;
            setPending(null);
            void (async () => {
              await wipeCustomFieldValues(fieldId);
              const nextFields = template.fields.filter((field) => field.id !== fieldId);
              await update({ detailCardTemplate: { version: 1, fields: nextFields } });
            })();
          }}
        />
      ) : null}
      {pending?.kind === 'type' ? (
        <ConfirmModal
          title="Сменить тип поля?"
          message={`Тип поля «${pendingLabel}» станет «${CUSTOM_FIELD_TYPE_LABELS[pending.type]}». Значения поля сотрутся на всех карточках этой библиотеки.`}
          confirmLabel="Сменить тип"
          confirmVariant="danger"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const fieldId = pending.fieldId;
            const type = pending.type;
            setPending(null);
            void (async () => {
              await wipeCustomFieldValues(fieldId);
              await update({
                detailCardTemplate: applyDetailFieldType(template, fieldId, type)
              });
            })();
          }}
        />
      ) : null}
    </div>
  );
}
