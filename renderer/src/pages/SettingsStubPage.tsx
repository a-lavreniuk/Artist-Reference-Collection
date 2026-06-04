import SettingsVersionLabel from './SettingsVersionLabel';

export default function SettingsStubPage() {
  return (
    <div
      className="arc-settings-page arc-ui-kit-scope"
      data-elevation="sunken"
      data-typo-role="primary"
      data-typo-tone="white"
      data-typo-state="default"
      data-btn-size="l"
      data-input-size="l"
    >
      <div className="arc-page-empty panel elevation-default">
        <p className="typo-p-m">Общие настройки приложения появятся в следующих версиях.</p>
        <p className="typo-p-m">Разделы «Хранилище», «Статистика», «История» и «Поиск дублей» доступны в меню навбара.</p>
      </div>
      <SettingsVersionLabel />
    </div>
  );
}
