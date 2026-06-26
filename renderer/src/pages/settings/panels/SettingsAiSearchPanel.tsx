import type { ReactNode } from 'react';
import DemoAlert from '../../../components/layout/DemoAlert';
import ValueSlider from '../../../components/range-slider/ValueSlider';
import { Loader } from '../../../components/loader';
import AiModelCard from '../../../components/settings/AiModelCard';
import SettingsHardwareRow from '../../../components/settings/SettingsHardwareRow';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import ConfirmModal from '../ConfirmModal';
import {
  AI_INTRO_TEXT,
  formatCpuLabel,
  formatGpuLabel,
  formatRamGb,
  isIndexComplete,
  modelCardTitle,
  strictnessHint,
  tierShortLabel
} from '../aiSettingsFormatters';
import {
  isActiveModelInstalled,
  isAiDownloading,
  resolveDownloadStatus,
  resolveIndexStatusLine,
  resolveInstallStatus
} from '../settingsAiSession';
import { useSettingsArcHint } from '../hooks/useSettingsArcHint';
import { useSettingsAi } from '../hooks/useSettingsAi';
import type { AiModelTier } from '../../../services/appPreferences';

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="arc-settings-section__title typo-p-s">{children}</p>;
}

/** Figma 1036:38165–1036:39527 — AI Поиск */
export default function SettingsAiSearchPanel() {
  const arcHint = useSettingsArcHint();
  const {
    snapshot,
    loading,
    status,
    phase,
    busy,
    cudaPrompt,
    alert,
    dismissAlert,
    setEnabled,
    downloadModel,
    deleteModel,
    testModel,
    testingTier,
    setActiveModel,
    reindex,
    pauseIndex,
    resumeIndex,
    updateResourcePreset,
    updateSearchStrictness,
    updateModel,
    cancelDownload,
    pauseDownload,
    resumeDownload
  } = useSettingsAi();

  const isDownloading = isAiDownloading(snapshot);
  const downloadStatus = resolveDownloadStatus(snapshot);
  const installStatus = resolveInstallStatus(snapshot);
  const indexStatusLine = resolveIndexStatusLine(snapshot);
  const showHardwareAndModels = phase === 'models' || phase === 'ready' || isDownloading;
  const showReadySections = phase === 'ready' && !isDownloading;
  const activeModelReady = isActiveModelInstalled(status);
  const index = status?.index;
  const indexRunning = Boolean(index?.running);
  const operationBusy = busy && !indexRunning;
  const disabled = !window.arc || operationBusy;

  const minRamMb = status?.activeTier
    ? status.modelCards.find((c) => c.tier === status.activeTier)?.minRamMb ?? 2048
    : 2048;

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-settings-ai-panel arc-ui-kit-scope" data-btn-size="m">
          {loading ? (
            <p className="typo-p-m arc-settings-ai-panel__status">Загрузка настроек AI…</p>
          ) : !status ? (
            arcHint ? (
              <div className="typo-p-m hint arc-settings-electron-hint">{arcHint}</div>
            ) : (
              <p className="typo-p-m arc-settings-ai-panel__status">AI Поиск недоступен.</p>
            )
          ) : (
            <>
              <div className="arc-settings-ai-panel__intro">
                <p className="typo-p-m arc-settings-desc-block__text">{AI_INTRO_TEXT}</p>
                <SettingsToggleRow
                  label="Включить AI Поиск"
                  pressed={status.enabled}
                  disabled={disabled || isDownloading}
                  onPressedChange={(on) => void setEnabled(on)}
                />
              </div>

              {phase === 'analyzing' ? (
                <>
                  <SettingsSeparator />
                  <p className="typo-p-m arc-settings-ai-panel__status" data-typo-role="secondary">
                    Анализирую характеристики системы…
                  </p>
                </>
              ) : null}

              {showHardwareAndModels ? (
                <>
                  <SettingsSeparator />

                  <div className="arc-settings-ai-panel__section">
                    <SectionLabel>Характеристики системы</SectionLabel>
                    <SettingsHardwareRow label="CPU" value={formatCpuLabel(status.hardware)} />
                    <SettingsHardwareRow label="GPU" value={formatGpuLabel(status.hardware)} />
                    <SettingsHardwareRow label="RAM" value={formatRamGb(status.hardware.totalMemoryMb)} />
                  </div>

                  <SettingsSeparator />

                  <div className="arc-settings-ai-panel__section">
                    <SectionLabel>Модели</SectionLabel>
                    <div className="arc-settings-ai-model-cards">
                      {status.modelCards.map((card) => {
                        const install = status.models.find((m) => m.tier === card.tier);
                        const isCardDownloading =
                          snapshot.downloadTier === card.tier ||
                          status.download?.tier === card.tier ||
                          Boolean(install?.downloading);
                        const isTesting = testingTier === card.tier;
                        const cardDisabled = disabled || !card.supported;
                        const isActive = status.activeTier === card.tier && Boolean(install?.installed);
                        const tierLabel = tierShortLabel(card.tier);
                        const title = modelCardTitle(card, status.hardware.recommendedTier, tierLabel);
                        const updateAvailable = Boolean(install?.updateAvailable);

                        return (
                          <AiModelCard
                            key={card.tier}
                            variant={phase === 'ready' && install?.installed ? 'radio' : 'checkbox'}
                            label={title}
                            description={card.description}
                            checked={phase === 'ready' ? isActive : Boolean(install?.installed)}
                            disabled={cardDisabled || Boolean(isCardDownloading)}
                            onCheckedChange={() => {
                              if (install?.installed) {
                                if (phase === 'ready') {
                                  void setActiveModel(card.tier as AiModelTier);
                                }
                                return;
                              }
                              if (card.supported) {
                                void downloadModel(card.tier as AiModelTier);
                              }
                            }}
                            actions={
                              install?.installed ? (
                                <div className="btn-group btn-group-ds">
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-ds"
                                    disabled={disabled || Boolean(isCardDownloading) || isTesting}
                                    onClick={() => void testModel(card.tier as AiModelTier)}
                                  >
                                    <span className="btn-ds__value">{isTesting ? 'Проверка…' : 'Проверить'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-ds"
                                    disabled={disabled || Boolean(isCardDownloading) || isTesting}
                                    onClick={() =>
                                      void (updateAvailable
                                        ? updateModel(card.tier as AiModelTier)
                                        : downloadModel(card.tier as AiModelTier))
                                    }
                                  >
                                    <span className="btn-ds__value">
                                      {updateAvailable ? 'Обновить' : 'Перезагрузить'}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-ds"
                                    disabled={disabled || Boolean(isCardDownloading) || isTesting}
                                    onClick={() => void deleteModel(card.tier as AiModelTier)}
                                  >
                                    <span className="btn-ds__value">Удалить</span>
                                  </button>
                                </div>
                              ) : null
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  {downloadStatus ? (
                    <div className="arc-settings-ai-panel__download-block">
                      <div className="arc-settings-ai-status-head">
                        <h3 className="h3 arc-settings-ai-status-head__title">Идёт скачивание</h3>
                        <span className="h3 arc-settings-ai-status-head__percent" data-typo-role="secondary">
                          {downloadStatus.percent}%
                        </span>
                      </div>
                      {downloadStatus.subtitle ? (
                        <p className="typo-p-m arc-settings-ai-status-head__subtitle" data-typo-role="secondary">
                          {downloadStatus.subtitle}
                        </p>
                      ) : null}
                      <div className="arc-settings-ai-panel__action-row">
                        <button
                          type="button"
                          className="btn btn-secondary btn-ds"
                          disabled={!window.arc}
                          onClick={() => void cancelDownload()}
                        >
                          <span className="btn-ds__value">Отменить скачивание</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-ds"
                          disabled={!window.arc}
                          onClick={() =>
                            void (downloadStatus.paused ? resumeDownload() : pauseDownload())
                          }
                        >
                          <span className="btn-ds__value">
                            {downloadStatus.paused ? 'Возобновить' : 'Поставить на паузу'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {installStatus ? (
                    <div className="arc-settings-ai-panel__download-block">
                      <div className="arc-settings-ai-status-head">
                        <h3 className="h3 arc-settings-ai-status-head__title">Установка</h3>
                        <span className="h3 arc-settings-ai-status-head__percent" data-typo-role="secondary">
                          {installStatus.percent}%
                        </span>
                      </div>
                      <p className="typo-p-m arc-settings-ai-status-head__subtitle" data-typo-role="secondary">
                        Идёт извлечение и установка файлов, пожалуйста подождите…
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {showReadySections ? (
                <>
                  <SettingsSeparator />

                  <div className="arc-settings-ai-sliders-row">
                    <div className="arc-settings-ai-slider-col">
                      <SectionLabel>Точность поиска {status.searchStrictness}%</SectionLabel>
                      <ValueSlider
                        size="s"
                        min={0}
                        max={100}
                        step={5}
                        value={status.searchStrictness}
                        showValue={false}
                        disabled={disabled}
                        formatValue={(v) => `${v}`}
                        onChange={(value) => void updateSearchStrictness(value)}
                        ariaLabel="Точность поиска"
                      />
                      <p className="typo-p-m arc-settings-ai-slider-col__hint">{strictnessHint(status.searchStrictness)}</p>
                    </div>
                    <div className="arc-settings-ai-slider-col">
                      <SectionLabel>
                        Ресурсы {status.resourcePreset}% ({formatRamGb(status.resources.maxRamMb)})
                      </SectionLabel>
                      <ValueSlider
                        size="s"
                        min={10}
                        max={100}
                        step={5}
                        value={status.resourcePreset}
                        showValue={false}
                        disabled={disabled}
                        formatValue={(v) => `${v}%`}
                        onChange={(value) => void updateResourcePreset(value)}
                        ariaLabel="Ресурсы для AI"
                      />
                      <p className="typo-p-m arc-settings-ai-slider-col__hint">
                        Доступно {formatRamGb(status.hardware.totalMemoryMb)}. Минимум для модели{' '}
                        {formatRamGb(minRamMb)}
                      </p>
                    </div>
                  </div>

                  <SettingsSeparator />

                  <div className="arc-settings-ai-panel__section">
                    <SectionLabel>Индексация</SectionLabel>

                    {indexRunning ? (
                      <>
                        <div className="arc-settings-ai-index-line">
                          {!index?.paused ? <Loader decorative /> : null}
                          <p className="typo-p-m arc-settings-ai-index-line__text">{indexStatusLine}</p>
                        </div>
                        <div className="arc-settings-ai-panel__action-row">
                          {index?.paused ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-ds"
                              disabled={!window.arc || isDownloading}
                              onClick={() => void resumeIndex()}
                            >
                              <span className="btn-ds__value">Возобновить</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-ds"
                              disabled={!window.arc || isDownloading}
                              onClick={() => void pauseIndex()}
                            >
                              <span className="btn-ds__value">Поставить на паузу</span>
                            </button>
                          )}
                        </div>
                      </>
                    ) : isIndexComplete(status) ? (
                      <>
                        <p className="typo-p-m arc-settings-ai-index-line__text">{indexStatusLine}</p>
                        <div className="arc-settings-ai-panel__action-row">
                          <button
                            type="button"
                            className="btn btn-secondary btn-ds"
                            disabled={disabled || !activeModelReady}
                            onClick={() => void reindex()}
                          >
                            <span className="btn-ds__value">Повторить индексацию</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {!activeModelReady ? (
                          <p className="typo-p-m arc-settings-ai-slider-col__hint">
                            Сначала установите и выберите активную модель.
                          </p>
                        ) : null}
                        <div className="arc-settings-ai-panel__action-row">
                          <button
                            type="button"
                            className="btn btn-secondary btn-ds"
                            disabled={disabled || !activeModelReady}
                            onClick={() => void reindex()}
                          >
                            <span className="btn-ds__value">Повторить индексацию</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {alert ? <DemoAlert message={alert.message} variant={alert.variant} onClose={dismissAlert} /> : null}

      {cudaPrompt ? (
        <ConfirmModal
          title="Ускорение для vision-моделей"
          message="Обнаружена видеокарта NVIDIA. Скачать CUDA-сборку llama-server (~450 МБ) для ускорения индексации тяжёлой модели?"
          confirmLabel="Скачать CUDA"
          cancelLabel="Только CPU"
          onConfirm={cudaPrompt.onConfirm}
          onCancel={cudaPrompt.onCancel}
        />
      ) : null}
    </>
  );
}
