import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ReleaseNotesModal, { type ReleaseNotesData } from './ReleaseNotesModal';
import UpdateAvailableModal, { type UpdateModalPhase } from './UpdateAvailableModal';

type AppUpdateContextValue = {
  previewReleaseNotes: (data: ReleaseNotesData) => void;
};

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function useAppUpdate(): AppUpdateContextValue {
  const ctx = useContext(AppUpdateContext);
  if (!ctx) {
    throw new Error('useAppUpdate must be used within AppUpdateProvider');
  }
  return ctx;
}

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updatePhase, setUpdatePhase] = useState<UpdateModalPhase>('prompt');
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesData | null>(null);
  const [releaseNotesPreview, setReleaseNotesPreview] = useState(false);
  const pendingUpdateVersionRef = useRef<string | null>(null);
  const releaseNotesRef = useRef<ReleaseNotesData | null>(null);
  const changelogResolvedRef = useRef(false);

  releaseNotesRef.current = releaseNotes;

  const flushPendingUpdate = useCallback(() => {
    const pending = pendingUpdateVersionRef.current;
    if (!pending) return;
    pendingUpdateVersionRef.current = null;
    setUpdateVersion(pending);
    setUpdatePhase('prompt');
    setDownloadPercent(null);
  }, []);

  const tryFlushPendingUpdate = useCallback(() => {
    if (!changelogResolvedRef.current) return;
    if (releaseNotesRef.current) return;
    flushPendingUpdate();
  }, [flushPendingUpdate]);

  const closeReleaseNotes = useCallback(async () => {
    if (!releaseNotes) return;

    if (!releaseNotesPreview && window.arc?.setLastSeenReleaseVersion) {
      await window.arc.setLastSeenReleaseVersion(releaseNotes.version);
    }

    setReleaseNotes(null);
    setReleaseNotesPreview(false);
    tryFlushPendingUpdate();
  }, [releaseNotes, releaseNotesPreview, tryFlushPendingUpdate]);

  const previewReleaseNotes = useCallback((data: ReleaseNotesData) => {
    setReleaseNotesPreview(true);
    setReleaseNotes(data);
  }, []);

  const openReleaseNotesDetails = useCallback(async () => {
    if (!releaseNotes) return;

    const version = releaseNotes.version;

    if (!releaseNotesPreview && window.arc?.setLastSeenReleaseVersion) {
      await window.arc.setLastSeenReleaseVersion(version);
    }

    setReleaseNotes(null);
    setReleaseNotesPreview(false);
    navigate('/settings/updates', { state: { releaseNotesVersion: version } });
    tryFlushPendingUpdate();
  }, [releaseNotes, releaseNotesPreview, navigate, tryFlushPendingUpdate]);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.getAppVersion) {
      changelogResolvedRef.current = true;
      tryFlushPendingUpdate();
      return;
    }

    void (async () => {
      const version = await arc.getAppVersion();
      const lastSeen = arc.getLastSeenReleaseVersion ? await arc.getLastSeenReleaseVersion() : null;

      if (lastSeen === null) {
        if (arc.setLastSeenReleaseVersion) {
          await arc.setLastSeenReleaseVersion(version);
        }
        changelogResolvedRef.current = true;
        tryFlushPendingUpdate();
        return;
      }

      if (lastSeen === version) {
        changelogResolvedRef.current = true;
        tryFlushPendingUpdate();
        return;
      }

      const notes = arc.getReleaseNotes ? await arc.getReleaseNotes(version) : null;
      changelogResolvedRef.current = true;

      if (!notes?.changes?.length) {
        tryFlushPendingUpdate();
        return;
      }

      setReleaseNotesPreview(false);
      setReleaseNotes({
        version,
        buildDate: notes.buildDate,
        changes: notes.changes
      });
    })();
  }, [tryFlushPendingUpdate]);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.onUpdateAvailable) return;

    const unsubAvailable = arc.onUpdateAvailable(({ version }) => {
      pendingUpdateVersionRef.current = version;
      tryFlushPendingUpdate();
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
  }, [tryFlushPendingUpdate]);

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
    <AppUpdateContext.Provider value={{ previewReleaseNotes }}>
      {children}
      {releaseNotes ? (
        <ReleaseNotesModal
          data={releaseNotes}
          onClose={() => void closeReleaseNotes()}
          onDetails={() => void openReleaseNotesDetails()}
        />
      ) : null}
      {updateVersion && !releaseNotes ? (
        <UpdateAvailableModal
          version={updateVersion}
          phase={updatePhase}
          downloadPercent={downloadPercent}
          onUpdate={handleUpdate}
          onLater={handleLater}
        />
      ) : null}
    </AppUpdateContext.Provider>
  );
}
