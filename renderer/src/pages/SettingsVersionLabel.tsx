import { useCallback, useEffect, useState } from 'react';
import ReleaseNotesModal, { type ReleaseNotesData } from '../components/layout/ReleaseNotesModal';

export default function SettingsVersionLabel() {
  const [version, setVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesData | null>(null);

  useEffect(() => {
    if (!window.arc?.getAppVersion) return;
    void window.arc.getAppVersion().then(setVersion);
  }, []);

  const openNotes = useCallback(async () => {
    if (!version || !window.arc?.getReleaseNotes) return;
    const notes = await window.arc.getReleaseNotes(version);
    if (!notes) return;
    setReleaseNotes({
      version,
      buildDate: notes.buildDate,
      changes: notes.changes
    });
  }, [version]);

  if (!version) return null;

  return (
    <>
      <button type="button" className="arc-settings-version typo-p-l" onClick={() => void openNotes()}>
        v{version}
      </button>
      {releaseNotes ? (
        <ReleaseNotesModal
          data={releaseNotes}
          onClose={() => {
            setReleaseNotes(null);
          }}
        />
      ) : null}
    </>
  );
}
