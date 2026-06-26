import { useEffect, useState } from 'react';

import { addTag, type CategoryRecord } from '../../../../services/db';

import TagSettingsModal, { type TagSettingsModalState } from '../../../tags/TagSettingsModal';



type SearchPanelCreateTagActionProps = {

  query: string;

  categories: CategoryRecord[];

  onCreated: (tagId: string) => void;

  onReloadIndex: () => Promise<void>;

};



/** Inline «Добавить» + TagSettingsModal (Figma 891-12067). */

export default function SearchPanelCreateTagAction({

  query,

  categories,

  onCreated,

  onReloadIndex

}: SearchPanelCreateTagActionProps) {

  const [modal, setModal] = useState<TagSettingsModalState | null>(null);

  const [pendingOpen, setPendingOpen] = useState(false);

  const firstCategoryId = categories[0]?.id;



  useEffect(() => {

    if (!pendingOpen || !firstCategoryId) return;

    setModal({ mode: 'create', categoryId: firstCategoryId, initialName: query });

    setPendingOpen(false);

  }, [firstCategoryId, pendingOpen, query]);



  const openCreate = () => {

    if (firstCategoryId) {

      setModal({ mode: 'create', categoryId: firstCategoryId, initialName: query });

      return;

    }

    setPendingOpen(true);

    void onReloadIndex();

  };



  return (

    <>

      <button type="button" className="arc-search-panel-create-tag-link" onClick={openCreate}>

        Добавить

      </button>

      {modal ? (

        <TagSettingsModal

          state={modal}

          categories={categories}

          onClose={() => setModal(null)}

          onCreate={async (payload) => {

            const tag = await addTag(payload.categoryId, payload.name, {

              description: payload.description,

              tooltipImageDataUrl: payload.tooltipImageDataUrl

            });

            await onReloadIndex();

            onCreated(tag.id);

            setModal(null);

          }}

          onSave={async () => {}}

          onDelete={async () => {}}

        />

      ) : null}

    </>

  );

}


