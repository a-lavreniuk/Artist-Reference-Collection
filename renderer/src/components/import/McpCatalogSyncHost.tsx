import { useEffect, type ReactNode } from 'react';

import {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  invalidateTagsCache
} from '../../services/db';

/** Синхронизирует каталог меток после изменений через MCP. */
export default function McpCatalogSyncHost({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!window.arc?.onMcpTagCatalogChanged) return undefined;
    return window.arc.onMcpTagCatalogChanged(() => {
      invalidateTagsCache();
      window.dispatchEvent(new Event(ARC_CATEGORIES_CHANGED_EVENT));
      window.dispatchEvent(new Event(ARC_TAGS_CHANGED_EVENT));
    });
  }, []);

  return <>{children}</>;
}
