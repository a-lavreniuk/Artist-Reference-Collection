import { useCallback, useEffect, useState } from 'react';
import ReleaseNotesModal, { type ReleaseNotesData } from './ReleaseNotesModal';
import UpdateAvailableModal, { type UpdateModalPhase } from './UpdateAvailableModal';

export default function AppUpdateHost() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updatePhase, setUpdatePhase] = useState<UpdateModalPhase>('prompt');
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesData | null>(null);

  const closeReleaseNotes = useCallback(async () => {
    if (!releaseNotes || !window.arc?.setLastSeenReleaseVersion) {
      setReleaseNotes(null);
      return;
    }
    await window.arc.setLastSeenReleaseVersion(releaseNotes.version);
    setReleaseNotes(null);
  }, [releaseNotes]);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.getAppVersion || updateVersion) return;

    void (async () => {
      const version = await arc.getAppVersion();
      const lastSeen = arc.getLastSeenReleaseVersion ? await arc.getLastSeenReleaseVersion() : null;
      if (lastSeen === version) return;

      const notes = arc.getReleaseNotes ? await arc.getReleaseNotes(version) : null;
      if (!notes?.changes?.length) return;

      setReleaseNotes({
        version,
        buildDate: notes.buildDate,
        changes: notes.changes
      });
    })();
  }, [updateVersion]);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.onUpdateAvailable) return;

    const unsubAvailable = arc.onUpdateAvailable(({ version }) => {
      setUpdateVersion(version);
      setUpdatePhase('prompt');
      setDownloadPercent(null);
      setReleaseNotes(null);
    });

    const unsubProgress = arc.onUpdateDownloadProgress?.(({ percent }) => {
      setDownloadPercent(percent);
    });

    const unsubDownloaded = arc.onUpdateDownloaded?.(() => {
      setUpdatePhase('installing');
      setDownloadPercent(100);
      void arc.quitAndInstall?.();
    });

    const unsubError = arc.onUpdateError?.(() => {
      setUpdatePhase('prompt');
      setDownloadPercent(null);
    });

    return () => {
      unsubAvailable();
      unsubProgress?.();
      unsubDownloaded?.();
      unsubError?.();
    };
  }, []);

  const handleLater = useCallback(async () => {
    if (updateVersion && window.arc?.dismissUpdateVersion) {
      await window.arc.dismissUpdateVersion(updateVersion);
    }
    setUpdateVersion(null);
    setUpdatePhase('prompt');
    setDownloadPercent(null);
  }, [updateVersion]);

  const handleUpdate = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.downloadUpdate) return;

    setUpdatePhase('downloading');
    setDownloadPercent(0);
    const res = await arc.downloadUpdate();
    if (!res?.ok) {
      setUpdatePhase('prompt');
      setDownloadPercent(null);
    }
  }, []);

  return (
    <>
      {updateVersion ? (
        <UpdateAvailableModal
          version={updateVersion}
          phase={updatePhase}
          downloadPercent={downloadPercent}
          onUpdate={handleUpdate}
          onLater={handleLater}
        />
      ) : null}
      {releaseNotes && !updateVersion ? (
        <ReleaseNotesModal data={releaseNotes} onClose={closeReleaseNotes} />
      ) : null}
    </>
  );
}
