import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';

const LABEL_AUTOPLAY = 'Автоматически воспроизводить видео при открытии деталки';

export default function SettingsVideoPlaybackPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

  return (
    <div className="arc-settings-main__scroll">
      <div className={`arc-settings-main__content${ready ? ' is-prefs-ready' : ''}`}>
        <SettingsSection title="Воспроизведение">
          <SettingsToggleRow
            label={LABEL_AUTOPLAY}
            pressed={prefs?.videoAutoplay !== false}
            disabled={disabled}
            onPressedChange={(videoAutoplay) => void update({ videoAutoplay })}
          />
        </SettingsSection>
      </div>
    </div>
  );
}
