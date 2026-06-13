type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function TagsPageSearch({ value, onChange }: Props) {
  return (
    <label
      className={`field search-live arc-tags-page-search${value.length > 0 ? ' has-value' : ''}`}
      data-live-search
    >
      <div className="input search-field input-slots">
        <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
        <input
          className="search-inner slot-value"
          placeholder="Поиск по категориям и меткам…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Поиск по категориям и меткам"
        />
        <button
          type="button"
          className="input-inline-icon search-clear-btn input-inline-icon--close arc-icon-close slot-trailing"
          aria-label="Очистить поиск"
          onClick={() => onChange('')}
        />
      </div>
    </label>
  );
}
