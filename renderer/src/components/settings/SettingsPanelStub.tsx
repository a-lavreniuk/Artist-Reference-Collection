type Props = {
  title: string;
};

export default function SettingsPanelStub({ title }: Props) {
  return (
    <div className="arc-settings-main__scroll">
      <div className="arc-settings-main__content">
        <div className="arc-page-empty panel elevation-default">
          <p className="typo-p-m">Раздел «{title}» в разработке.</p>
        </div>
      </div>
    </div>
  );
}
