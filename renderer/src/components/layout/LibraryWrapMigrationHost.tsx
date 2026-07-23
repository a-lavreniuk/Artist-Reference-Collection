import { useEffect, useState } from 'react';
import LibraryWrapMigrationModal from './LibraryWrapMigrationModal';

let wrapMigrationModalShownThisSession = false;

export default function LibraryWrapMigrationHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!window.arc?.getLibraryMigrationStatus || wrapMigrationModalShownThisSession) return;
    void (async () => {
      const status = await window.arc!.getLibraryMigrationStatus();
      if (status.status !== 'needs_wrap_name') return;
      wrapMigrationModalShownThisSession = true;
      setOpen(true);
    })();
  }, []);

  if (!open) return null;

  return (
    <LibraryWrapMigrationModal
      onClose={() => {
        setOpen(false);
      }}
    />
  );
}
