import { useCallback, useEffect, useState } from 'react';
import ReleaseNotesModal, { type ReleaseNotesData } from './ReleaseNotesModal';
import UpdateAvailableModal from './UpdateAvailableModal';

export default function AppUpdateHost() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [readyToInstall, setReadyToInstall] = useState(false);
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
    if (!arc?.getAppVersion) return;

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
  }, []);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.onUpdateAvailable) return;

    const unsubAvailable = arc.onUpdateAvailable(({ version }) => {
      setUpdateVersion(version);
      setDownloading(false);
      setDownloadPercent(null);
      setReadyToInstall(false);
    });

    const unsubProgress = arc.onUpdateDownloadProgress?.(({ percent }) => {
      setDownloadPercent(percent);
    });

    const unsubDownloaded = arc.onUpdateDownloaded?.(() => {
      setDownloading(false);
      setReadyToInstall(true);
      void arc.quitAndInstall?.();
    });

    const unsubError = arc.onUpdateError?.(() => {
      setDownloading(false);
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
    setDownloading(false);
    setDownloadPercent(null);
    setReadyToInstall(false);
  }, [updateVersion]);

  const handleUpdate = useCallback(async () => {
    const arc = window.arc;
    if (!arc) return;

    if (readyToInstall) {
      await arc.quitAndInstall?.();
      return;
    }

    setDownloading(true);
    const res = await arc.downloadUpdate?.();
    if (!res?.ok) {
      setDownloading(false);
    }
  }, [readyToInstall]);

  return (
    <>
      {updateVersion ? (
        <UpdateAvailableModal
          version={updateVersion}
          downloading={downloading}
          downloadPercent={downloadPercent}
          readyToInstall={readyToInstall}
          onUpdate={handleUpdate}
          onLater={handleLater}
        />
      ) : null}
      {releaseNotes ? <ReleaseNotesModal data={releaseNotes} onClose={closeReleaseNotes} /> : null}
    </>
  );
}
