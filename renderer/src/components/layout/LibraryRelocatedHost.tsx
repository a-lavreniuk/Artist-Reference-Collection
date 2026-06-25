import { useEffect, useState } from 'react';
import LibraryRelocatedModal from './LibraryRelocatedModal';

let relocateModalShownThisSession = false;

export default function LibraryRelocatedHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!window.arc?.checkLibraryRelocateModal || relocateModalShownThisSession) return;
    void (async () => {
      const check = await window.arc!.checkLibraryRelocateModal();
      if (!check.show) return;
      relocateModalShownThisSession = true;
      setOpen(true);
    })();
  }, []);

  if (!open) return null;

  return (
    <LibraryRelocatedModal
      onClose={() => {
        setOpen(false);
      }}
    />
  );
}
