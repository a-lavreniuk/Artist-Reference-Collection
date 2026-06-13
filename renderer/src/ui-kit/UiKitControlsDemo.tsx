import { useState } from 'react';
import ArcCheckbox from '../components/ui/ArcCheckbox';
import ArcRadio from '../components/ui/ArcRadio';
import ArcToggle from '../components/settings/ArcToggle';
import SettingsCheckboxRow from '../components/settings/SettingsCheckboxRow';
import SettingsControlRow from '../components/settings/SettingsControlRow';
import SettingsRadioRow from '../components/settings/SettingsRadioRow';
import SettingsSection from '../components/settings/SettingsSection';
import SettingsSeparator from '../components/settings/SettingsSeparator';
import SettingsToggleRow from '../components/settings/SettingsToggleRow';

export default function UiKitControlsDemo() {
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [checkboxOn, setCheckboxOn] = useState(true);
  const [checkboxOff, setCheckboxOff] = useState(false);
  const [radioValue, setRadioValue] = useState('a');

  return (
    <div className="stack">
      <div className="inputs-group">
        <div className="id-tag">EL-TOG-GROUP</div>
        <h3 className="h3">Toggle</h3>
        <div className="demo-row">
          <div className="sample">
            <div className="id-tag">EL-TOG-ON</div>
            <ArcToggle pressed={toggleOn} aria-label="Включён" onPressedChange={setToggleOn} />
          </div>
          <div className="sample">
            <div className="id-tag">EL-TOG-OFF</div>
            <ArcToggle pressed={toggleOff} aria-label="Выключен" onPressedChange={setToggleOff} />
          </div>
          <div className="sample">
            <div className="id-tag">EL-TOG-DIS-ON</div>
            <ArcToggle pressed disabled aria-label="Отключён, включён" />
          </div>
          <div className="sample">
            <div className="id-tag">EL-TOG-DIS-OFF</div>
            <ArcToggle pressed={false} disabled aria-label="Отключён, выключен" />
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-CHK-GROUP</div>
        <h3 className="h3">Checkbox</h3>
        <div className="demo-row">
          <div className="sample">
            <div className="id-tag">EL-CHK-ON</div>
            <ArcCheckbox checked />
          </div>
          <div className="sample">
            <div className="id-tag">EL-CHK-OFF</div>
            <ArcCheckbox checked={false} />
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-RAD-GROUP</div>
        <h3 className="h3">Radio</h3>
        <div className="demo-row">
          <div className="sample">
            <div className="id-tag">EL-RAD-ON</div>
            <ArcRadio checked />
          </div>
          <div className="sample">
            <div className="id-tag">EL-RAD-OFF</div>
            <ArcRadio checked={false} />
          </div>
        </div>
      </div>

      <hr className="separator" />

      <div className="inputs-group">
        <div className="id-tag">EL-CTRL-ROW-GROUP</div>
        <h3 className="h3">Строки (Row)</h3>
        <p className="text-s" style={{ margin: 0, color: 'var(--typo-tone-secondary)' }}>
          Кликабельны control, gap и label — как в настройках.
        </p>
        <SettingsSection title="Toggle">
          <SettingsToggleRow label="Включён" pressed={toggleOn} onPressedChange={setToggleOn} />
          <SettingsToggleRow label="Выключен" pressed={toggleOff} onPressedChange={setToggleOff} />
          <SettingsToggleRow label="Отключён (вкл.)" pressed disabled />
          <SettingsToggleRow label="Отключён (выкл.)" pressed={false} disabled />
        </SettingsSection>
        <SettingsSeparator />
        <SettingsSection title="Checkbox">
          <SettingsCheckboxRow label="Отмечен" checked={checkboxOn} onCheckedChange={setCheckboxOn} />
          <SettingsCheckboxRow label="Не отмечен" checked={checkboxOff} onCheckedChange={setCheckboxOff} />
          <SettingsCheckboxRow label="Отключён (отмечен)" checked disabled />
          <SettingsCheckboxRow label="Отключён (не отмечен)" checked={false} disabled />
        </SettingsSection>
        <SettingsSeparator />
        <SettingsSection title="Radio">
          <SettingsRadioRow
            label="Вариант A"
            checked={radioValue === 'a'}
            onCheckedChange={() => setRadioValue('a')}
          />
          <SettingsRadioRow
            label="Вариант B"
            checked={radioValue === 'b'}
            onCheckedChange={() => setRadioValue('b')}
          />
          <SettingsRadioRow label="Отключён" checked={false} disabled />
        </SettingsSection>
        <SettingsSeparator />
        <SettingsSection title="Control row (variant)">
          <SettingsControlRow
            variant="toggle"
            label="Строка с toggle — кликабельна целиком, включая отступ до текста."
            checked={toggleOn}
            onCheckedChange={setToggleOn}
          />
          <SettingsControlRow
            variant="checkbox"
            label="Строка с checkbox — кликабельна целиком, включая отступ до текста."
            checked={checkboxOn}
            onCheckedChange={setCheckboxOn}
          />
          <SettingsControlRow
            variant="radio"
            label="Строка с radio — кликабельна целиком, включая отступ до текста."
            checked={radioValue === 'a'}
            onCheckedChange={() => setRadioValue('a')}
          />
        </SettingsSection>
      </div>
    </div>
  );
}
