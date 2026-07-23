import { useEffect, useState } from 'react';
import LibraryWrapMigrationModal from './LibraryWrapMigrationModal';

/**
 * Self-named legacy: модалка обязательна, пока статус needs_wrap_name.
 * Закрытие без completeWrapMigration не допускается.
 */
export default function LibraryWrapMigrationHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!window.arc?.getLibraryMigrationStatus) return;
    void (async () => {
      const status = await window.arc!.getLibraryMigrationStatus();
      if (status.status === 'needs_wrap_name') setOpen(true);
    })();
  }, []);

  if (!open) return null;

  return (
    <LibraryWrapMigrationModal
      onComplete={() => {
        setOpen(false);
      }}
    />
  );
}
