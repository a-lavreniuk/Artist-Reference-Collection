import { useCallback, useEffect, useRef, useState } from 'react';
import CardDetailCollectionsModal from '../gallery/CardDetailCollectionsModal';
import {
  ARC_CARDS_CHANGED_EVENT,
  addCollection,
  getAllCollections,
  getCardById
} from '../../services/db';
import { getAppPreferencesSync } from '../../services/appPreferencesRuntime';
import { showAppNotification } from '../../services/notificationService';

type Props = {
  children: React.ReactNode;
};

export default function ScreenshotHost({ children }: Props) {
  const [pickerCardId, setPickerCardId] = useState<string | null>(null);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const pendingScreenshotAlertRef = useRef(false);

  const showScreenshotSavedAlert = useCallback(() => {
    showAppNotification({
      message: 'Скриншот сохранён',
      variant: 'success',
      prefKey: 'notifyScreenshotSaved'
    });
  }, []);

  useEffect(() => {
    if (!window.arc?.onScreenshotSaved) return undefined;
    return window.arc.onScreenshotSaved(({ cardId }) => {
      window.dispatchEvent(new CustomEvent(ARC_CARDS_CHANGED_EVENT));

      const prefs = getAppPreferencesSync();
      if (prefs.screenshotAskSaveLocation) {
        pendingScreenshotAlertRef.current = true;
        void (async () => {
          const card = await getCardById(cardId);
          setCollectionIds(card?.collectionIds ?? []);
          setPickerCardId(cardId);
        })();
        return;
      }

      showScreenshotSavedAlert();
    });
  }, [showScreenshotSavedAlert]);

  const closePicker = useCallback(() => {
    if (pendingScreenshotAlertRef.current) {
      pendingScreenshotAlertRef.current = false;
      showScreenshotSavedAlert();
    }
    setPickerCardId(null);
    setCollectionIds([]);
  }, [showScreenshotSavedAlert]);

  const toggleCollection = useCallback(
    async (collectionId: string) => {
      if (!pickerCardId || !window.arc?.storageUpdateCard) return;
      const next = collectionIds.includes(collectionId)
        ? collectionIds.filter((id) => id !== collectionId)
        : [...collectionIds, collectionId];
      setCollectionIds(next);
      await window.arc.storageUpdateCard(pickerCardId, { collectionIds: next });
      window.dispatchEvent(new CustomEvent(ARC_CARDS_CHANGED_EVENT));
    },
    [pickerCardId, collectionIds]
  );

  const createAndAssign = useCallback(
    async (name: string) => {
      if (!pickerCardId) return;
      const col = await addCollection(name);
      const all = await getAllCollections();
      const created = all.find((c) => c.id === col.id) ?? col;
      const next = [...collectionIds, created.id];
      setCollectionIds(next);
      if (window.arc?.storageUpdateCard) {
        await window.arc.storageUpdateCard(pickerCardId, { collectionIds: next });
      }
      window.dispatchEvent(new CustomEvent(ARC_CARDS_CHANGED_EVENT));
    },
    [pickerCardId, collectionIds]
  );

  return (
    <>
      {children}
      {pickerCardId ? (
        <CardDetailCollectionsModal
          selectedCollectionIds={collectionIds}
          onClose={closePicker}
          onToggleCollection={(collectionId) => void toggleCollection(collectionId)}
          onCreateAndAssign={(name) => createAndAssign(name)}
        />
      ) : null}
    </>
  );
}
