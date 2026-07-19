import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ValueSlider from '../../../components/range-slider/ValueSlider';
import SettingsOptionCard from '../../../components/settings/SettingsOptionCard';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { autoTagVolumeHint } from '../aiSettingsFormatters';
import { useSettingsArcHint } from '../hooks/useSettingsArcHint';
import { useSettingsAutoTag } from '../hooks/useSettingsAutoTag';

const LABEL_DESCRIPTION =
  'ARC может предлагать и назначать метки по содержимому изображений и видео (кадры) с помощью тяжёлой AI-модели (JoyCaption).';

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="arc-settings-section__title text-s">{children}</p>;
}

/** Автотегирование — отдельный раздел настроек (паттерн как у Автоимпорта). */
export default function SettingsAutoTagPanel() {
  const arcHint = useSettingsArcHint();
  const {
    heavyInstalled,
    baseDisabled,
    enableDisabled,
    enabled,
    volume,
    onImport,
    createNew,
    videoCaptionOnImport,
    setEnabled,
    setVolume,
    setOnImport,
    setCreateNew,
    setVideoCaptionOnImport
  } = useSettingsAutoTag();

  return (
    <div className="arc-settings-main__scroll">
      <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">
        <div className="arc-settings-desc-block">
          <p className="text-m arc-settings-desc-block__text">{LABEL_DESCRIPTION}</p>

          {!heavyInstalled ? (
            <p className="text-m arc-settings-desc-block__text" data-typo-role="secondary">
              Нужна установленная тяжёлая модель.{' '}
              <Link to="/settings/ai-search" className="arc-integrity-section__link">
                Открыть AI Поиск
              </Link>
            </p>
          ) : null}

          <SettingsToggleRow
            label="Включить автотегирование"
            pressed={enabled}
            disabled={enableDisabled && !enabled}
            onPressedChange={(on) => void setEnabled(on)}
          />

          {enabled ? (
            <>
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
                  description="Назначать подходящие метки после тяжёлой индексации изображений и после импорта видео"
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
              </div>
            </>
          ) : null}

          <div className="arc-settings-ai-option-stack">
            <SettingsOptionCard
              variant="toggle"
              label="AI описание видео после импорта"
              description={
                heavyInstalled
                  ? 'После импорта видео — до трёх кадров и одно описание из суммы подписей JoyCaption'
                  : 'После импорта видео — до трёх кадров и одно описание из суммы подписей JoyCaption. Для работы нужна установленная тяжёлая модель (Настройки → AI Поиск)'
              }
              checked={videoCaptionOnImport}
              disabled={baseDisabled}
              onCheckedChange={(on) => void setVideoCaptionOnImport(on)}
            />
          </div>

          {!window.arc && arcHint ? <div className="hint arc-settings-electron-hint">{arcHint}</div> : null}
        </div>
      </div>
    </div>
  );
}
