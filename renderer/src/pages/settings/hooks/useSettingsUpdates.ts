import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DemoAlertVariant } from '../../../components/layout/DemoAlert';

export type ReleaseNotesVersion = {
  version: string;
  buildDate: string;
  changes: string[];
};

export type UpdatesCheckState =
  | 'idle'
  | 'checking'
  | 'updateAvailable'
  | 'downloading'
  | 'installing';

type AlertState = {
  message: string;
  variant: DemoAlertVariant;
} | null;

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return a.localeCompare(b);
}

function isNewerVersion(candidate: string, installed: string): boolean {
  return compareSemver(candidate, installed) > 0;
}

function parseUpdateVersion(updateInfo: unknown): string | null {
  if (!updateInfo || typeof updateInfo !== 'object') return null;
  const v = (updateInfo as { version?: unknown }).version;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function useSettingsUpdates() {
  const location = useLocation();
  const navigate = useNavigate();
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [versions, setVersions] = useState<ReleaseNotesVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<UpdatesCheckState>('idle');
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.getAppVersion || !arc.listReleaseNotes) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const [installed, notesRes] = await Promise.all([arc.getAppVersion(), arc.listReleaseNotes()]);
        setInstalledVersion(installed);
        setVersions(notesRes.versions);
        const hasInstalled = notesRes.versions.some((v) => v.version === installed);
        setSelectedVersion(hasInstalled ? installed : (notesRes.versions[0]?.version ?? installed));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const versionFromNav = (location.state as { releaseNotesVersion?: string } | null)?.releaseNotesVersion;
    if (!versionFromNav || versions.length === 0) return;
    if (!versions.some((v) => v.version === versionFromNav)) return;
    setSelectedVersion(versionFromNav);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, versions]);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.onUpdateDownloadProgress) return;

    const unsubProgress = arc.onUpdateDownloadProgress?.(({ percent }) => {
      setDownloadPercent(percent);
    });
    const unsubDownloaded = arc.onUpdateDownloaded?.(() => {
      setCheckState('installing');
      setDownloadPercent(100);
      void arc.quitAndInstall?.();
    });
    const unsubError = arc.onUpdateError?.(({ message }) => {
      setCheckState('idle');
      setDownloadPercent(null);
      setAlert({ message: String(message || 'Не удалось проверить обновления.'), variant: 'warning' });
    });

    return () => {
      unsubProgress?.();
      unsubDownloaded?.();
      unsubError?.();
    };
  }, []);

  const selectedEntry = useMemo(
    () => versions.find((v) => v.version === selectedVersion) ?? null,
    [versions, selectedVersion]
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  const checkUpdates = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.checkForUpdates || !installedVersion) return;

    setCheckState('checking');
    setAvailableVersion(null);
    setDownloadPercent(null);

    const res = await arc.checkForUpdates();

    if (!res.ok) {
      setCheckState('idle');
      if (res.reason === 'dev') {
        setAlert({
          message: 'Проверка обновлений доступна только в установленной версии приложения.',
          variant: 'warning'
        });
        return;
      }
      setAlert({ message: 'Не удалось проверить обновления.', variant: 'warning' });
      return;
    }

    const remoteVersion = parseUpdateVersion(res.updateInfo);
    if (remoteVersion && isNewerVersion(remoteVersion, installedVersion)) {
      setAvailableVersion(remoteVersion);
      setCheckState('updateAvailable');
      return;
    }

    setCheckState('idle');
    setAlert({ message: 'У вас установлена последняя версия.', variant: 'info' });
  }, [installedVersion]);

  const startUpdate = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.downloadUpdate) return;

    setCheckState('downloading');
    setDownloadPercent(0);
    const res = await arc.downloadUpdate();
    if (!res?.ok) {
      setCheckState('updateAvailable');
      setDownloadPercent(null);
      setAlert({ message: 'Не удалось загрузить обновление.', variant: 'warning' });
    }
  }, []);

  const checking = checkState === 'checking';
  const updateBusy = checkState === 'downloading' || checkState === 'installing';

  return {
    loading,
    installedVersion,
    versions,
    selectedVersion,
    setSelectedVersion,
    selectedEntry,
    checkState,
    availableVersion,
    downloadPercent,
    alert,
    dismissAlert,
    checkUpdates,
    startUpdate,
    checking,
    updateBusy
  };
}
