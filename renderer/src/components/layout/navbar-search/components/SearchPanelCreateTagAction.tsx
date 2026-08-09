type SearchPanelCreateTagActionProps = {
  query: string;
  onOpenCreate: (query: string) => void;
};

/** Inline «Добавить» — открывает модалку создания метки на уровне NavbarSearchProvider. */
export default function SearchPanelCreateTagAction({
  query,
  onOpenCreate
}: SearchPanelCreateTagActionProps) {
  return (
    <button type="button" className="arc-search-panel-create-tag-link" onClick={() => onOpenCreate(query)}>
      Добавить
    </button>
  );
}
