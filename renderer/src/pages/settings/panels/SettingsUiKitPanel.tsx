import { useState } from 'react';
import SettingsCheckboxRow from '../../../components/settings/SettingsCheckboxRow';
import SettingsControlRow from '../../../components/settings/SettingsControlRow';
import SettingsOptionCard from '../../../components/settings/SettingsOptionCard';
import SettingsRadioRow from '../../../components/settings/SettingsRadioRow';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import SettingsShortcutRow from '../../../components/settings/SettingsShortcutRow';
import SettingsShortcutsSearch from '../../../components/settings/SettingsShortcutsSearch';

const CARD_DESCRIPTION = 'Consectetur adipiscing elit, sed do eiusmod tempor';

export default function SettingsUiKitPanel() {
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [checkboxOn, setCheckboxOn] = useState(true);
  const [checkboxOff, setCheckboxOff] = useState(false);
  const [radioValue, setRadioValue] = useState('a');
  const [cardToggle, setCardToggle] = useState(false);
  const [cardCheckbox, setCardCheckbox] = useState(true);
  const [cardRadio, setCardRadio] = useState('x');
  const [longToggle, setLongToggle] = useState(false);
  const [shortcutsSearch, setShortcutsSearch] = useState('');

  return (
    <div className="arc-settings-main__scroll">
      <div className="arc-settings-main__content">
        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Отступы</h2>
          <div className="arc-settings-ui-kit-spacer-demo">
            <div className="arc-settings-ui-kit-spacer-demo__row">
              <span className="arc-settings-ui-kit-spacer-demo__bar" style={{ width: 'var(--s-1)' }} />
              <span className="typo-p-s">--s-1 (6px) — gap между control и label в строке</span>
            </div>
            <div className="arc-settings-ui-kit-spacer-demo__row">
              <span className="arc-settings-ui-kit-spacer-demo__bar" style={{ width: 'var(--s-2)' }} />
              <span className="typo-p-s">--s-2 (8px) — gap внутри секции</span>
            </div>
            <div className="arc-settings-ui-kit-spacer-demo__row">
              <span className="arc-settings-ui-kit-spacer-demo__bar" style={{ width: 'var(--s-4)' }} />
              <span className="typo-p-s">--s-4 (32px) — padding контента и отступ сепаратора сверху/снизу</span>
            </div>
          </div>
        </section>

        <SettingsSeparator />

        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Сепаратор</h2>
          <SettingsSection title="Отступы">
            <div className="arc-settings-ui-kit-separator-demo">
              <div className="arc-settings-ui-kit-separator-demo__block">Секция выше</div>
              <SettingsSeparator />
              <div className="arc-settings-ui-kit-separator-demo__block">Секция ниже</div>
            </div>
          </SettingsSection>
        </section>

        <SettingsSeparator />

        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Toggle</h2>
          <SettingsSection title="Состояния">
            <SettingsToggleRow label="Включён" pressed={toggleOn} onPressedChange={setToggleOn} />
            <SettingsToggleRow label="Выключен" pressed={toggleOff} onPressedChange={setToggleOff} />
            <SettingsToggleRow label="Отключён (вкл.)" pressed disabled />
            <SettingsToggleRow label="Отключён (выкл.)" pressed={false} disabled />
          </SettingsSection>
        </section>

        <SettingsSeparator />

        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Checkbox</h2>
          <SettingsSection title="Состояния">
            <SettingsCheckboxRow label="Отмечен" checked={checkboxOn} onCheckedChange={setCheckboxOn} />
            <SettingsCheckboxRow label="Не отмечен" checked={checkboxOff} onCheckedChange={setCheckboxOff} />
            <SettingsCheckboxRow label="Отключён (отмечен)" checked disabled />
            <SettingsCheckboxRow label="Отключён (не отмечен)" checked={false} disabled />
          </SettingsSection>
        </section>

        <SettingsSeparator />

        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Radio</h2>
          <SettingsSection title="Группа">
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
        </section>

        <SettingsSeparator />

        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Строки (Row)</h2>
          <SettingsSection title="Варианты control">
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
          <SettingsSection title="Элементы запуска">
            <SettingsToggleRow
              label="Запускать ARC при входе в систему."
              pressed={toggleOn}
              onPressedChange={setToggleOn}
            />
            <SettingsToggleRow
              label="При закрытии окна сворачивать приложение, а не закрывать."
              pressed={toggleOff}
              onPressedChange={setToggleOff}
            />
          </SettingsSection>
          <SettingsSection title="Поведение с файлами">
            <SettingsToggleRow
              label="Удалять исходные файлы после добавления их в систему и формирования карточки. Эти файлы будут перенесены в системную корзину."
              pressed={longToggle}
              onPressedChange={setLongToggle}
            />
          </SettingsSection>
        </section>

        <SettingsSeparator />

        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Карточки (Card)</h2>
          <SettingsSection title="Toggle">
            <div className="arc-settings-ui-kit-cards">
              <SettingsOptionCard
                variant="toggle"
                label="Lorem ipsum dolor sit amet"
                description={CARD_DESCRIPTION}
                checked={cardToggle}
                onCheckedChange={setCardToggle}
              />
              <SettingsOptionCard
                variant="toggle"
                label="Lorem ipsum dolor sit amet"
                description={CARD_DESCRIPTION}
                checked
                disabled
              />
            </div>
          </SettingsSection>
          <SettingsSection title="Checkbox">
            <div className="arc-settings-ui-kit-cards">
              <SettingsOptionCard
                variant="checkbox"
                label="Lorem ipsum dolor sit amet"
                description={CARD_DESCRIPTION}
                checked={cardCheckbox}
                onCheckedChange={setCardCheckbox}
              />
              <SettingsOptionCard
                variant="checkbox"
                label="Lorem ipsum dolor sit amet"
                description={CARD_DESCRIPTION}
                checked={false}
              />
              <SettingsOptionCard
                variant="checkbox"
                label="Lorem ipsum dolor sit amet"
                description={CARD_DESCRIPTION}
                checked={false}
                disabled
              />
            </div>
          </SettingsSection>
          <SettingsSection title="Radio">
            <div className="arc-settings-ui-kit-cards">
              <SettingsOptionCard
                variant="radio"
                label="Lorem ipsum dolor sit amet"
                description={CARD_DESCRIPTION}
                checked={cardRadio === 'x'}
                onCheckedChange={() => setCardRadio('x')}
              />
              <SettingsOptionCard
                variant="radio"
                label="Lorem ipsum dolor sit amet"
                description={CARD_DESCRIPTION}
                checked={cardRadio === 'y'}
                onCheckedChange={() => setCardRadio('y')}
              />
            </div>
          </SettingsSection>
        </section>

        <SettingsSeparator />

        <section className="arc-settings-ui-kit-block">
          <h2 className="h2 arc-settings-ui-kit-block__title">Горячие клавиши</h2>
          <SettingsSection title="Поиск и строка">
            <div className="arc-ui-kit-scope" data-input-size="m">
              <SettingsShortcutsSearch value={shortcutsSearch} onChange={setShortcutsSearch} />
            </div>
            <SettingsShortcutRow label="Отменить" shortcut="Ctrl+Z" />
            <SettingsShortcutRow label="Вернуть" shortcut="Ctrl+Y" />
          </SettingsSection>
        </section>
      </div>
    </div>
  );
}
