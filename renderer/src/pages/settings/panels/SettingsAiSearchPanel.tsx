import { useEffect, useRef, useState, type ReactNode } from 'react';
import ToastAlert from '../../../components/alert/ToastAlert';
import ValueSlider from '../../../components/range-slider/ValueSlider';
import { Loader } from '../../../components/loader';
import AiModelCard from '../../../components/settings/AiModelCard';
import SettingsHardwareRow from '../../../components/settings/SettingsHardwareRow';
import SettingsOptionCard from '../../../components/settings/SettingsOptionCard';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import type { JoyCaptionExtraId, JoyCaptionTypeId } from '../../../services/appPreferences';
import { sanitizeJoyCaptionLengthLevel } from '../../../services/appPreferences';
import type { AiModelCardInfo, AiModelRef, AiStatus } from '../../../services/aiTypes';
import ConfirmModal from '../ConfirmModal';
import {
  AI_INTRO_TEXT,
  captionLengthHint,
  captionLengthLabel,
  formatCpuLabel,
  formatGpuLabel,
  formatRamGb,
  isIndexComplete,
  modelCardTitle,
  strictnessHint
} from '../aiSettingsFormatters';
import {
  JOY_CAPTION_EXTRA_OPTIONS,
  JOY_CAPTION_TYPE_OPTIONS
} from '../joyCaptionSettingsCopy';
import {
  isActiveModelInstalled,
  isAiDownloading,
  isCaptionModelInstalled,
  resolveDownloadStatus,
  resolveIndexStatusLine,
  resolveInstallStatus
} from '../settingsAiSession';
import { useSettingsArcHint } from '../hooks/useSettingsArcHint';
import { useSettingsAi } from '../hooks/useSettingsAi';
import { useSettingsAutoTag } from '../hooks/useSettingsAutoTag';

type AiSettingsTab = 'search' | 'caption' | 'tags';

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

/** Единый раздел AI: общие ресурсы + табы Поиск / Описание / Теги. */
export default function SettingsAiSearchPanel() {
  const arcHint = useSettingsArcHint();
  const { prefs, ready: prefsReady, update: updatePrefs } = useAppPreferences();
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
    setCaptionEnabled,
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
    updateModel
  } = useSettingsAi();
  const autoTag = useSettingsAutoTag();

  const [tab, setTab] = useState<AiSettingsTab>('search');
  const [captionDownloadOwner, setCaptionDownloadOwner] = useState<'caption' | 'tags' | null>(null);

  const isDownloading = isAiDownloading(snapshot);
  const downloadStatus = resolveDownloadStatus(snapshot);
  const installStatus = resolveInstallStatus(snapshot);
  const indexStatusLine = resolveIndexStatusLine(snapshot);
  const activeModelReady = isActiveModelInstalled(status);
  const captionInstalled = isCaptionModelInstalled(status);
  const index = status?.index;
  const indexRunning = Boolean(index?.running);
  const operationBusy = busy && !indexRunning;
  const disabled = !window.arc || operationBusy;

  const activeSearchCard =
    status?.searchModelCards.find((c) => c.modelId === status.activeSearchModelId) ??
    status?.searchModelCards[0];
  const minRamMb = activeSearchCard?.minRamMb ?? status?.captionModelCard.minRamMb ?? 2048;

  const anyFeatureOn = Boolean(
    status?.enabled || status?.captionEnabled || autoTag.enabled || captionDownloadOwner
  );
  const downloadRole =
    snapshot.downloadTier ?? status?.download?.role ?? status?.download?.modelId ?? status?.download?.tier ?? null;
  const captionDownloading =
    isDownloading &&
    (downloadRole === 'caption' || downloadRole === 'heavy' || downloadRole === 'joycaption-beta-one');
  const searchDownloading = isDownloading && !captionDownloading;

  const [captionType, setCaptionTypeState] = useState<JoyCaptionTypeId>(
    () => prefs?.aiCaptionType ?? 'descriptive_casual'
  );
  const [captionLengthLevel, setCaptionLengthState] = useState(
    () => prefs?.aiCaptionLengthLevel ?? 80
  );
  const [captionExtraIds, setCaptionExtraIdsState] = useState<JoyCaptionExtraId[]>(
    () => prefs?.aiCaptionExtraIds ?? []
  );
  const captionRef = useRef({
    type: captionType,
    length: captionLengthLevel,
    extras: captionExtraIds
  });
  captionRef.current = {
    type: captionType,
    length: captionLengthLevel,
    extras: captionExtraIds
  };

  useEffect(() => {
    if (!prefs) return;
    setCaptionTypeState(prefs.aiCaptionType);
    setCaptionLengthState(prefs.aiCaptionLengthLevel);
    setCaptionExtraIdsState(prefs.aiCaptionExtraIds);
  }, [prefs]);

  const captionExtraSet = new Set(captionExtraIds);
  const captionControlsDisabled = !prefsReady || !status?.captionEnabled;

  const persistCaption = (partial: {
    type?: JoyCaptionTypeId;
    length?: number;
    extras?: JoyCaptionExtraId[];
  }) => {
    const next = {
      type: partial.type ?? captionRef.current.type,
      length: sanitizeJoyCaptionLengthLevel(partial.length ?? captionRef.current.length),
      extras: partial.extras ?? captionRef.current.extras
    };
    captionRef.current = next;
    setCaptionTypeState(next.type);
    setCaptionLengthState(next.length);
    setCaptionExtraIdsState(next.extras);
    void updatePrefs({
      aiCaptionType: next.type,
      aiCaptionLengthLevel: next.length,
      aiCaptionExtraIds: next.extras
    });
  };

  const resolveCardProgress = (downloading: boolean) => {
    if (!downloading) return null;
    if (installStatus) {
      return { title: 'Установка', percent: installStatus.percent };
    }
    if (downloadStatus) {
      return { title: 'Идёт скачивание', percent: downloadStatus.percent };
    }
    return { title: 'Идёт скачивание', percent: 0 };
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
    const cardDisabled = disabled || !card.supported;
    const installed = Boolean(install?.installed);
    const isActive = status.activeSearchModelId === card.modelId && installed;
    const title = modelCardTitle(card, status.hardware.recommendedSearchModelId);
    const updateAvailable = Boolean(install?.updateAvailable);
    const useRadio = (phase === 'ready' || status.enabled) && installed;

    return (
      <AiModelCard
        key={card.role}
        variant={useRadio ? 'radio' : 'checkbox'}
        label={title}
        description={card.description}
        checked={useRadio ? isActive : installed}
        disabled={cardDisabled || downloading}
        progress={resolveCardProgress(downloading)}
        onCheckedChange={() => {
          if (installed) {
            if (phase === 'ready' || status.enabled) {
              void setActiveModel(cardRef(card));
            }
            return;
          }
          if (card.supported) {
            void downloadModel(cardRef(card));
          }
        }}
        actions={
          installed && !downloading ? (
            <div className="btn-group btn-group-ds">
              <button
                type="button"
                className="btn btn-ds"
                disabled={disabled || isTesting}
                onClick={() => void testModel(cardRef(card))}
              >
                <span className="btn-ds__value">{isTesting ? 'Проверка…' : 'Проверить'}</span>
              </button>
              <button
                type="button"
                className="btn btn-ds"
                disabled={disabled || isTesting}
                onClick={() =>
                  void (updateAvailable ? updateModel(cardRef(card)) : downloadModel(cardRef(card)))
                }
              >
                <span className="btn-ds__value">
                  {updateAvailable ? 'Обновить' : 'Перезагрузить'}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ds"
                disabled={disabled || isTesting}
                onClick={() => void deleteModel(cardRef(card))}
              >
                <span className="btn-ds__value">Удалить</span>
              </button>
            </div>
          ) : null
        }
      />
    );
  };

  /** Временная плашка JoyCaption только на время скачивания (табы Описание / Метки). */
  const renderCaptionDownloadCard = () => {
    if (!status) return null;
    const card = status.captionModelCard;
    return (
      <div className="arc-settings-ai-tab-block">
        <div className="arc-settings-ai-model-cards arc-settings-ai-model-cards--stack">
          <AiModelCard
            variant="checkbox"
            label={card.label}
            description={card.description}
            checked={false}
            disabled
            progress={resolveCardProgress(true)}
          />
        </div>
      </div>
    );
  };

  const handleCaptionToggle = async (enabled: boolean) => {
    if (!enabled) {
      await setCaptionEnabled(false);
      return;
    }

    if (captionInstalled) {
      await setCaptionEnabled(true);
      return;
    }

    setCaptionDownloadOwner('caption');
    try {
      const installed = await downloadModel('caption');
      if (installed) await setCaptionEnabled(true);
    } catch {
      // Ошибка уже показывается общей AI-сессией; режим остаётся выключенным.
    } finally {
      setCaptionDownloadOwner(null);
    }
  };

  const handleAutoTagToggle = async (enabled: boolean) => {
    if (!enabled) {
      await autoTag.setEnabled(false);
      return;
    }
    if (captionInstalled) {
      await autoTag.setEnabled(true);
      return;
    }

    setCaptionDownloadOwner('tags');
    try {
      const installed = await downloadModel('caption');
      if (installed) await autoTag.setEnabled(true);
    } catch {
      // Ошибка уже показывается общей AI-сессией; режим остаётся выключенным.
    } finally {
      setCaptionDownloadOwner(null);
    }
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

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div className="arc-settings-main__content arc-settings-ai-panel arc-ui-kit-scope" data-btn-size="m">
          {loading ? (
            <p className="text-m arc-settings-ai-panel__status">Загрузка настроек AI…</p>
          ) : !status ? (
            arcHint ? (
              <div className="hint arc-settings-electron-hint">{arcHint}</div>
            ) : (
              <p className="text-m arc-settings-ai-panel__status">AI недоступен.</p>
            )
          ) : (
            <>
              <div className="arc-settings-ai-panel__intro">
                <p className="text-m arc-settings-desc-block__text">{AI_INTRO_TEXT}</p>
              </div>

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

              {anyFeatureOn ? (
                <>
                  <SettingsSeparator />
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
                    <p className="text-m arc-settings-ai-slider-col__hint">
                      Доступно {formatRamGb(status.hardware.totalMemoryMb)}. Минимум для активной модели{' '}
                      {formatRamGb(minRamMb)}
                    </p>
                  </div>
                </>
              ) : null}

              <SettingsSeparator />

              <div className="tabs tabs-wrap" role="tablist" aria-label="Разделы AI">
                {(
                  [
                    { key: 'search' as const, label: 'Поиск' },
                    { key: 'caption' as const, label: 'Описание' },
                    { key: 'tags' as const, label: 'Теги' }
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.key}
                    className={`tab-button${tab === item.key ? ' is-active' : ''}`}
                    onClick={() => setTab(item.key)}
                  >
                    <span className="tab-button__label">{item.label}</span>
                  </button>
                ))}
              </div>

              {tab === 'search' ? (
                <div className="arc-settings-ai-tab-panel" role="tabpanel">
                  <div className="arc-settings-ai-tab-block">
                    <p className="text-m arc-settings-desc-block__text">
                      Поиск на естественном языке сравнивает запрос с содержимым карточек. Выберите модель по
                      скорости и качеству: CLIP работает быстрее, Qwen точнее понимает сложные визуальные запросы.
                    </p>
                    <SettingsToggleRow
                      label="Включить AI Поиск"
                      pressed={status.enabled}
                      disabled={disabled || isDownloading}
                      onPressedChange={(on) => void setEnabled(on)}
                    />
                  </div>

                  {status.enabled || searchDownloading ? (
                    <>
                      <div className="arc-settings-ai-tab-block">
                        <SectionLabel>Модели поиска</SectionLabel>
                        <div className="arc-settings-ai-model-cards arc-settings-ai-model-cards--stack">
                          {status.searchModelCards.map((card) => renderModelCard(card))}
                        </div>
                      </div>

                      {(phase === 'ready' || activeModelReady) && !searchDownloading ? (
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
                          <p className="text-m arc-settings-ai-slider-col__hint">
                            {strictnessHint(status.searchStrictness)}
                          </p>
                        </div>
                      ) : null}

                      {(phase === 'ready' || activeModelReady) && !searchDownloading ? (
                        <div className="arc-settings-ai-tab-block">{renderIndexSection()}</div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              {tab === 'caption' ? (
                <div className="arc-settings-ai-tab-panel" role="tabpanel">
                  <div className="arc-settings-ai-tab-block">
                    <p className="text-m arc-settings-desc-block__text">
                      ARC создаёт текстовые описания изображений с помощью JoyCaption. Описания сохраняются локально
                      и улучшают продвинутый поиск, когда активна модель Qwen.
                    </p>
                    <SettingsToggleRow
                      label="Включить AI Описание"
                      pressed={status.captionEnabled || captionDownloadOwner === 'caption'}
                      disabled={disabled || isDownloading}
                      onPressedChange={(on) => void handleCaptionToggle(on)}
                    />
                  </div>

                  {status.captionEnabled || captionDownloadOwner === 'caption' ? (
                    <>
                      {captionDownloadOwner === 'caption' ||
                      (captionDownloading && captionDownloadOwner === null)
                        ? renderCaptionDownloadCard()
                        : null}

                      {captionInstalled && !captionDownloading ? (
                        <>
                          <div className="arc-settings-ai-tab-block arc-settings-ai-slider-col">
                            <SectionLabel>
                              Длина описания — {captionLengthLabel(captionLengthLevel)}
                            </SectionLabel>
                            <ValueSlider
                              size="s"
                              min={0}
                              max={100}
                              step={20}
                              value={captionLengthLevel}
                              showValue={false}
                              disabled={captionControlsDisabled}
                              formatValue={(v) => `${v}`}
                              onChange={(value) => persistCaption({ length: value })}
                              ariaLabel="Длина описания"
                            />
                            <p className="text-m arc-settings-ai-slider-col__hint">
                              {captionLengthHint(captionLengthLevel)}
                            </p>
                          </div>

                          <div className="arc-settings-ai-tab-block">
                            <SectionLabel>Тип описания</SectionLabel>
                            <div
                              className="arc-settings-ai-option-stack"
                              role="radiogroup"
                              aria-label="Тип описания"
                            >
                              {JOY_CAPTION_TYPE_OPTIONS.map((opt) => (
                                <SettingsOptionCard
                                  key={opt.id}
                                  variant="radio"
                                  label={opt.label}
                                  description={opt.description}
                                  checked={captionType === opt.id}
                                  disabled={captionControlsDisabled}
                                  onCheckedChange={() => persistCaption({ type: opt.id })}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="arc-settings-ai-tab-block">
                            <SectionLabel>Дополнительные настройки</SectionLabel>
                            <div className="arc-settings-ai-option-stack">
                              {JOY_CAPTION_EXTRA_OPTIONS.map((opt) => (
                                <SettingsOptionCard
                                  key={opt.id}
                                  variant="toggle"
                                  label={opt.label}
                                  description={opt.description}
                                  checked={captionExtraSet.has(opt.id)}
                                  disabled={captionControlsDisabled}
                                  onCheckedChange={(checked) => {
                                    const extras = checked
                                      ? [...captionRef.current.extras.filter((x) => x !== opt.id), opt.id]
                                      : captionRef.current.extras.filter((x) => x !== opt.id);
                                    persistCaption({ extras });
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              {tab === 'tags' ? (
                <div className="arc-settings-ai-tab-panel" role="tabpanel">
                  <div className="arc-settings-ai-tab-block">
                    <p className="text-m arc-settings-desc-block__text">
                      Автотегирование анализирует изображение или кадры видео с помощью JoyCaption, сопоставляет
                      результат с каталогом меток и при необходимости может создавать новые метки.
                    </p>
                    <SettingsToggleRow
                      label="Включить автотегирование"
                      pressed={autoTag.enabled || captionDownloadOwner === 'tags'}
                      disabled={autoTag.enableDisabled || isDownloading}
                      onPressedChange={(on) => void handleAutoTagToggle(on)}
                    />
                  </div>

                  {autoTag.enabled || captionDownloadOwner === 'tags' ? (
                    <>
                      {captionDownloadOwner === 'tags' ? renderCaptionDownloadCard() : null}

                      {captionInstalled && !captionDownloading ? (
                        <>
                          <div className="arc-settings-ai-tab-block arc-settings-ai-slider-col">
                            <SectionLabel>Объём меток {autoTag.volume}%</SectionLabel>
                            <ValueSlider
                              size="s"
                              min={0}
                              max={100}
                              step={5}
                              value={autoTag.volume}
                              showValue={false}
                              disabled={autoTag.baseDisabled}
                              formatValue={(v) => `${v}`}
                              onChange={(value) => void autoTag.setVolume(value)}
                              ariaLabel="Объём меток"
                            />
                            <p className="text-m arc-settings-ai-slider-col__hint">
                              {autoTag.volume <= 33
                                ? 'Меньше меток, чаще совпадение с уже существующими'
                                : autoTag.volume <= 66
                                  ? 'Баланс числа меток и точности сопоставления'
                                  : 'Больше предложений, порог совпадения ниже'}
                            </p>
                          </div>

                          <div className="arc-settings-ai-tab-block">
                            <SectionLabel>Дополнительные настройки</SectionLabel>
                            <div className="arc-settings-ai-option-stack">
                              <SettingsOptionCard
                                variant="toggle"
                                label="После импорта и индексации"
                                description="Назначать подходящие метки после индексации изображений и после импорта видео"
                                checked={autoTag.onImport}
                                disabled={autoTag.baseDisabled}
                                onCheckedChange={(on) => void autoTag.setOnImport(on)}
                              />
                              <SettingsOptionCard
                                variant="toggle"
                                label="Создавать новые метки"
                                description="Несматченные предложения попадают в категорию «Автоматически созданные метки»"
                                checked={autoTag.createNew}
                                disabled={autoTag.baseDisabled}
                                onCheckedChange={(on) => void autoTag.setCreateNew(on)}
                              />
                              <SettingsOptionCard
                                variant="toggle"
                                label="AI описание видео после импорта"
                                description="После импорта видео — до трёх кадров и одно описание из суммы подписей JoyCaption"
                                checked={autoTag.videoCaptionOnImport}
                                disabled={autoTag.baseDisabled}
                                onCheckedChange={(on) => void autoTag.setVideoCaptionOnImport(on)}
                              />
                            </div>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {alert ? <ToastAlert message={alert.message} variant={alert.variant} onClose={dismissAlert} /> : null}

      {cudaPrompt ? (
        <ConfirmModal
          title="Ускорение для vision-моделей"
          message="Обнаружена видеокарта NVIDIA. Скачать CUDA-сборку llama-server (~450 МБ) для ускорения индексации?"
          confirmLabel="Скачать CUDA"
          cancelLabel="Только CPU"
          onConfirm={cudaPrompt.onConfirm}
          onCancel={cudaPrompt.onCancel}
        />
      ) : null}
    </>
  );
}
