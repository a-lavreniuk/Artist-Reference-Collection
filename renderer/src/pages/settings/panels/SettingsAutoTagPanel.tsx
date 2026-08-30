import { type ReactNode } from 'react';
import ValueSlider from '../../../components/range-slider/ValueSlider';
import AiModelCard, { buildAiModelCardOptionsRows } from '../../../components/settings/AiModelCard';
import SettingsOptionCard from '../../../components/settings/SettingsOptionCard';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { AUTO_TAG_INTRO_TEXT, AUTO_TAG_MODEL_DESCRIPTION, autoTagVolumeHint } from '../aiSettingsFormatters';
import {
  isAiDownloading,
  isCaptionModelInstalled,
  isCaptionModelRef,
  logAiModelClient,
  resolveModelCardProgress
} from '../settingsAiSession';
import { useSettingsArcHint } from '../hooks/useSettingsArcHint';
import { useSettingsAi } from '../hooks/useSettingsAi';
import { useSettingsAutoTag } from '../hooks/useSettingsAutoTag';

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="arc-settings-section__title text-s">{children}</p>;
}

/** Автотеги: описание → тоггл → модель → настройки. */
export default function SettingsAutoTagPanel() {
  const arcHint = useSettingsArcHint();
  const {
    snapshot,
    loading,
    status,
    busy,
    downloadModel,
    deleteModel,
    testModel,
    testingTier,
    updateModel,
    cancelDownload,
    pauseDownload,
    resumeDownload
  } = useSettingsAi();
  const {
    captionProductInstalled,
    baseDisabled,
    enableDisabled,
    enabled,
    volume,
    onImport,
    createNew,
    videoCaptionOnImport,
    setEnabled,
    markModelInstalled,
    setVolume,
    setOnImport,
    setCreateNew,
    setVideoCaptionOnImport
  } = useSettingsAutoTag();

  const isDownloading = isAiDownloading(snapshot);
  const cardProgress = resolveModelCardProgress(snapshot);
  const indexRunning = Boolean(status?.index.running);
  const operationBusy = busy && !indexRunning;
  const disabled = !window.arc || operationBusy;
  const downloadPaused = snapshot.downloadPaused;
  const canPauseDownload = snapshot.downloadPhase === 'model' || snapshot.downloadPhase == null;
  const filesInstalled = isCaptionModelInstalled(status);
  const card = status?.captionModelCard;
  const downloadRole =
    snapshot.downloadTier ?? status?.download?.role ?? status?.download?.modelId ?? null;
  const downloading = isDownloading && isCaptionModelRef(downloadRole);
  const isTesting = isCaptionModelRef(testingTier);
  const install = status?.models.find((m) => m.role === 'caption' || m.modelId === 'joycaption-beta-one');
  const updateAvailable = Boolean(install?.updateAvailable);
  const selectable = captionProductInstalled && filesInstalled;
  const unavailableReason = card && !card.supported ? 'Мало RAM' : null;

  const chips = [{ label: 'JoyCaption' }, { label: card?.sizeLabel ?? '~5.5 ГБ' }];
  const optionsRows = buildAiModelCardOptionsRows({
    isTesting,
    disabled,
    updateAvailable,
    onTest: () => void testModel('caption'),
    onReload: () => void (updateAvailable ? updateModel('caption') : downloadModel('caption')),
    onDelete: () => void deleteModel('caption')
  });

  const handleInstall = async () => {
    logAiModelClient('клик Установить автотеги', {
      filesInstalled,
      captionProductInstalled,
      enabled,
      downloadRole
    });
    if (filesInstalled) {
      logAiModelClient('файлы уже считаются установленными — только флаг, без скачивания');
      await markModelInstalled();
      return;
    }
    logAiModelClient('файлы не видны в статусе — запускаем установку');
    const ok = await downloadModel('caption');
    if (ok) await markModelInstalled();
  };

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-settings-ai-panel arc-ui-kit-scope" data-btn-size="m">
          {loading ? (
            <p className="text-m arc-settings-ai-panel__status">Загрузка настроек…</p>
          ) : !window.arc && arcHint ? (
            <div className="hint arc-settings-electron-hint">{arcHint}</div>
          ) : (
            <>
              <div className="arc-settings-desc-block">
                <p className="text-m arc-settings-desc-block__text">{AUTO_TAG_INTRO_TEXT}</p>
                <SettingsToggleRow
                  label="Включить автотегирование"
                  pressed={enabled}
                  disabled={enableDisabled}
                  onPressedChange={(on) => void setEnabled(on)}
                />
              </div>

              {enabled || downloading ? (
                <>
                  <SettingsSeparator />
                  <div className="arc-settings-ai-tab-block">
                    <SectionLabel>Доступные модели</SectionLabel>
                    <div className="arc-settings-ai-model-cards arc-settings-ai-model-cards--stack">
                      <AiModelCard
                        title="Модель автотегов"
                        description={AUTO_TAG_MODEL_DESCRIPTION}
                        chips={chips}
                        selectable={selectable}
                        selected={false}
                        showRadio={false}
                        recommended={false}
                        unavailableReason={unavailableReason}
                        disabled={disabled}
                        progress={
                          downloading ? (cardProgress ?? { title: 'Идёт скачивание', percent: 0 }) : null
                        }
                        downloadPaused={downloadPaused}
                        canPauseDownload={canPauseDownload}
                        onInstall={() => void handleInstall()}
                        onPauseDownload={() => void pauseDownload()}
                        onResumeDownload={() => void resumeDownload()}
                        onCancelDownload={() => void cancelDownload()}
                        optionsRows={selectable ? optionsRows : undefined}
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {enabled && selectable ? (
                <>
                  <SettingsSeparator />
                  <div className="arc-settings-ai-slider-col">
                    <SectionLabel>Объём меток {volume}%</SectionLabel>
                    <ValueSlider
                      size="s"
                      min={0}
                      max={100}
                      step={5}
                      value={volume}
                      showValue={false}
                      disabled={baseDisabled}
                      formatValue={(v) => `${v}`}
                      onChange={(value) => void setVolume(value)}
                      ariaLabel="Объём меток"
                    />
                    <p className="text-m arc-settings-ai-slider-col__hint">{autoTagVolumeHint(volume)}</p>
                  </div>

                  <div className="arc-settings-ai-option-stack">
                    <SettingsOptionCard
                      variant="toggle"
                      label="После импорта и индексации"
                      description="Назначать подходящие метки после индексации изображений и после импорта видео"
                      checked={onImport}
                      disabled={baseDisabled}
                      onCheckedChange={(on) => void setOnImport(on)}
                    />
                    <SettingsOptionCard
                      variant="toggle"
                      label="Создавать новые метки"
                      description="Несматченные предложения попадают в категорию «Автоматически созданные метки»"
                      checked={createNew}
                      disabled={baseDisabled}
                      onCheckedChange={(on) => void setCreateNew(on)}
                    />
                    <SettingsOptionCard
                      variant="toggle"
                      label="AI описание видео после импорта"
                      description="После импорта видео — до трёх кадров и одно описание из суммы подписей JoyCaption"
                      checked={videoCaptionOnImport}
                      disabled={baseDisabled}
                      onCheckedChange={(on) => void setVideoCaptionOnImport(on)}
                    />
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
