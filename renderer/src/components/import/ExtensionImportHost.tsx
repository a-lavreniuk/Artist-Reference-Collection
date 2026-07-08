import { useEffect, type ReactNode } from 'react';
import { ARC_CARDS_CHANGED_EVENT } from '../../services/db';
import { notifyCollectionsChanged } from '../../services/db/events';
import { showAppNotification } from '../../services/notificationService';

export default function ExtensionImportHost({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!window.arc?.onExtensionImportSaved) return undefined;
    return window.arc.onExtensionImportSaved(({ cardIds, collectionId, quiet }) => {
      if (!cardIds.length) return;
      window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
      if (collectionId) {
        notifyCollectionsChanged();
      }
      if (quiet) return;

      const n = cardIds.length;
      const word = n === 1 ? 'изображение' : n < 5 ? 'изображения' : 'изображений';
      showAppNotification({
        message: n === 1 ? 'Изображение добавлено из браузера' : `Добавлено ${n} ${word} из браузера`,
        variant: 'success',
        prefKey: 'notifyFilesAdded'
      });
    });
  }, []);

  return <>{children}</>;
}
