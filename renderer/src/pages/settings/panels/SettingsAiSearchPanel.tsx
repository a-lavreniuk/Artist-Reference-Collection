import { type ReactNode } from 'react';
import ValueSlider from '../../../components/range-slider/ValueSlider';
import { Loader } from '../../../components/loader';
import AiModelCard, { buildAiModelCardOptionsRows } from '../../../components/settings/AiModelCard';
import SettingsHardwareRow from '../../../components/settings/SettingsHardwareRow';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import type { AiModelCardInfo, AiModelRef, AiStatus } from '../../../services/aiTypes';
import ConfirmModal from '../ConfirmModal';
import {
  AI_INTRO_TEXT,
  formatCpuLabel,
  formatGpuLabel,
  formatRamGb,
  isIndexComplete,
  modelCardTitle,
  searchModelChipLabel,
  searchModelUnavailableReason,
  strictnessHint
} from '../aiSettingsFormatters';
import {
  isActiveModelInstalled,
  isAiDownloading,
  isCaptionModelRef,
  resolveIndexStatusLine,
  resolveModelCardProgress
} from '../settingsAiSession';
import { useSettingsArcHint } from '../hooks/useSettingsArcHint';
import { useSettingsAi } from '../hooks/useSettingsAi';

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="arc-settings-section__title text-s">{children}</p>;
}

function findInstall(status: AiStatus, card: AiModelCardInfo) {
  return status.models.find((m) => m.role === card.role || m.modelId === card.modelId);
}

function cardRef(card: AiModelCardInfo): AiModelRef {
  return card.role;
}

function isCardDownloading(
  downloadTier: string | null,
  status: AiStatus,
  card: AiModelCardInfo,
  installDownloading: boolean
): boolean {
  return (
    downloadTier === card.role ||
    downloadTier === card.modelId ||
    status.download?.role === card.role ||
    status.download?.modelId === card.modelId ||
    installDownloading
  );
}

/** Умный поиск: описание → тоггл → железо → модели → настройки поиска. */
export default function SettingsAiSearchPanel() {
  const arcHint = useSettingsArcHint();
  const {
    snapshot,
    loading,
    status,
    phase,
    busy,
    cudaPrompt,
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
  const cardProgress = resolveModelCardProgress(snapshot);
  const indexStatusLine = resolveIndexStatusLine(snapshot);
  const activeModelReady = isActiveModelInstalled(status);
  const index = status?.index;
  const indexRunning = Boolean(index?.running);
  const operationBusy = busy && !indexRunning;
  const disabled = !window.arc || operationBusy;
  const downloadPaused = snapshot.downloadPaused;
  const canPauseDownload = snapshot.downloadPhase === 'model' || snapshot.downloadPhase == null;

  const activeSearchCard =
    status?.searchModelCards.find((c) => c.modelId === status.activeSearchModelId) ??
    status?.searchModelCards[0];
  const minRamMb = activeSearchCard?.minRamMb ?? 2048;

  const anySearchInstalled = Boolean(
    status?.searchModelCards.some((card) => Boolean(findInstall(status, card)?.installed))
  );

  const downloadRole =
    snapshot.downloadTier ?? status?.download?.role ?? status?.download?.modelId ?? null;
  const captionDownload = isCaptionModelRef(downloadRole);
  const searchDownloading = isDownloading && !captionDownload;
  const showSearchBody = Boolean(status?.enabled || searchDownloading || phase === 'analyzing');

  const resolveCardProgress = (downloading: boolean) => {
    if (!downloading) return null;
    return cardProgress ?? { title: 'Идёт скачивание', percent: 0 };
  };

  const renderModelCard = (card: AiModelCardInfo) => {
    if (!status) return null;
    const install = findInstall(status, card);
    const downloading = isCardDownloading(
      snapshot.downloadTier,
      status,
      card,
      Boolean(install?.downloading)
    );
    const isTesting = testingTier === card.role || testingTier === card.modelId;
    const installed = Boolean(install?.installed);
    const isActive = status.activeSearchModelId === card.modelId && installed;
    const updateAvailable = Boolean(install?.updateAvailable);
    const selectable = installed;
    const unavailableReason = searchModelUnavailableReason(card, status.hardware);
    const recommended =
      Boolean(status.hardware.recommendedSearchModelId) &&
      card.modelId === status.hardware.recommendedSearchModelId;
    const needsCuda = card.searchLevel === 'medium' || card.searchLevel === 'heavy';
    const chips = [
      { label: searchModelChipLabel(card.modelId) },
      ...(needsCuda ? [{ label: 'CUDA 12+' }] : []),
      { label: card.sizeLabel }
    ];

    const optionsRows = buildAiModelCardOptionsRows({
      isTesting,
      disabled,
      updateAvailable,
      onTest: () => void testModel(cardRef(card)),
      onReload: () =>
        void (updateAvailable ? updateModel(cardRef(card)) : downloadModel(cardRef(card))),
      onDelete: () => void deleteModel(cardRef(card))
    });

    return (
      <AiModelCard
        key={card.role}
        title={modelCardTitle(card)}
        description={card.description}
        chips={chips}
        selectable={selectable}
        selected={isActive}
        recommended={recommended && !unavailableReason}
        unavailableReason={unavailableReason}
        disabled={disabled}
        progress={resolveCardProgress(downloading)}
        downloadPaused={downloadPaused}
        canPauseDownload={canPauseDownload}
        onSelect={() => {
          if (selectable) void setActiveModel(cardRef(card));
        }}
        onInstall={() => {
          if (card.supported) void downloadModel(cardRef(card));
        }}
        onPauseDownload={() => void pauseDownload()}
        onResumeDownload={() => void resumeDownload()}
        onCancelDownload={() => void cancelDownload()}
        optionsRows={selectable ? optionsRows : undefined}
      />
    );
  };

  const renderIndexSection = () => {
    if (!status) return null;
    return (
      <div className="arc-settings-ai-panel__section">
        <SectionLabel>Индексация</SectionLabel>
        {indexRunning ? (
          <>
            <div className="arc-settings-ai-index-line">
              {!index?.paused ? <Loader decorative /> : null}
              <p className="text-m arc-settings-ai-index-line__text">{indexStatusLine}</p>
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
            <p className="text-m arc-settings-ai-index-line__text">{indexStatusLine}</p>
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
              <p className="text-m arc-settings-ai-slider-col__hint">
                Сначала установите и выберите активную модель поиска.
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
    );
  };

  const renderSearchSettings = () => {
    if (!status || !anySearchInstalled) return null;
    return (
      <>
        <SettingsSeparator />
        <div className="arc-settings-ai-tab-block arc-settings-ai-slider-col">
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
          <p className="text-m arc-settings-ai-slider-col__hint">{strictnessHint(status.searchStrictness)}</p>
        </div>
        <div className="arc-settings-ai-tab-block arc-settings-ai-slider-col">
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
          <p className="text-m arc-settings-ai-slider-col__hint">
            Доступно {formatRamGb(status.hardware.totalMemoryMb)}. Минимум для активной модели{' '}
            {formatRamGb(minRamMb)}
          </p>
        </div>
        <div className="arc-settings-ai-tab-block">{renderIndexSection()}</div>
      </>
    );
  };

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-settings-ai-panel arc-ui-kit-scope" data-btn-size="m">
          {loading ? (
            <p className="text-m arc-settings-ai-panel__status">Загрузка настроек…</p>
          ) : !status ? (
            arcHint ? (
              <div className="hint arc-settings-electron-hint">{arcHint}</div>
            ) : (
              <p className="text-m arc-settings-ai-panel__status">Умный поиск недоступен.</p>
            )
          ) : (
            <>
              <div className="arc-settings-desc-block">
                <p className="text-m arc-settings-desc-block__text">{AI_INTRO_TEXT}</p>
                <SettingsToggleRow
                  label="Включить умный поиск"
                  pressed={status.enabled}
                  disabled={!window.arc}
                  onPressedChange={(on) => void setEnabled(on)}
                />
              </div>

              {showSearchBody ? (
                <>
                  <SettingsSeparator />

                  {phase === 'analyzing' ? (
                    <p className="text-m arc-settings-ai-panel__status" data-typo-role="secondary">
                      Анализирую характеристики системы…
                    </p>
                  ) : (
                    <div className="arc-settings-ai-panel__section">
                      <SectionLabel>Характеристики системы</SectionLabel>
                      <SettingsHardwareRow label="CPU" value={formatCpuLabel(status.hardware)} />
                      <SettingsHardwareRow label="GPU" value={formatGpuLabel(status.hardware)} />
                      <SettingsHardwareRow label="RAM" value={formatRamGb(status.hardware.totalMemoryMb)} />
                    </div>
                  )}

                  <SettingsSeparator />

                  <div className="arc-settings-ai-tab-block">
                    <SectionLabel>Доступные модели</SectionLabel>
                    <div className="arc-settings-ai-model-cards arc-settings-ai-model-cards--stack">
                      {status.searchModelCards.map((card) => renderModelCard(card))}
                    </div>
                  </div>

                  {renderSearchSettings()}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {cudaPrompt ? (
        <ConfirmModal
          title="Ускорение для vision-моделей"
          message="Обнаружена видеокарта NVIDIA. Скачать CUDA-сборку llama-server и библиотеки CUDA (~820 МБ) для ускорения на GPU?"
          confirmLabel="Скачать CUDA"
          cancelLabel="Только CPU"
          onConfirm={cudaPrompt.onConfirm}
          onCancel={cudaPrompt.onCancel}
        />
      ) : null}
    </>
  );
}
