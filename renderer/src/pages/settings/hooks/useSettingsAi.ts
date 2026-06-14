import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  cancelAiDownload,
  deleteAiModel,
  dismissAiAlert,
  downloadAiModel,
  getAiSettingsSnapshot,
  initAiSettingsSession,
  pauseAiDownload,
  pauseAiIndex,
  refreshAiSettings,
  reindexAiLibrary,
  resumeAiDownload,
  resumeAiIndex,
  setActiveAiModel,
  setAiEnabled,
  subscribeAiSettings,
  testAiModel,
  updateAiModel,
  updateAiResourcePreset,
  updateAiSearchStrictness
} from '../settingsAiSession';

export {
  clampPercent,
  downloadProgressLabel,
  formatDownloadSubtitle,
  getEffectiveDownload,
  isActiveModelInstalled,
  isAiDownloading,
  resolveAiActivityMessage,
  resolveActivityProgress,
  resolveAiSetupPhase,
  resolveDownloadStatus,
  resolveIndexStatusLine,
  resolveInstallStatus,
  type AiSetupPhase,
  type CudaPromptState,
  type DownloadPhase
} from '../settingsAiSession';

export function useSettingsAi() {
  const snapshot = useSyncExternalStore(subscribeAiSettings, getAiSettingsSnapshot, getAiSettingsSnapshot);

  useEffect(() => {
    initAiSettingsSession();
    void refreshAiSettings();
  }, []);

  return {
    loading: snapshot.loading,
    status: snapshot.status,
    phase: snapshot.phase,
    busy: snapshot.busy,
    downloadTier: snapshot.downloadTier,
    downloadPercent: snapshot.downloadPercent,
    downloadPhase: snapshot.downloadPhase,
    downloadPaused: snapshot.downloadPaused,
    cudaPrompt: snapshot.cudaPrompt,
    alert: snapshot.alert,
    dismissAlert: dismissAiAlert,
    setEnabled: useCallback((enabled: boolean) => void setAiEnabled(enabled), []),
    downloadModel: useCallback((tier: Parameters<typeof downloadAiModel>[0]) => void downloadAiModel(tier), []),
    deleteModel: useCallback((tier: Parameters<typeof deleteAiModel>[0]) => void deleteAiModel(tier), []),
    testModel: useCallback((tier: Parameters<typeof testAiModel>[0]) => void testAiModel(tier), []),
    testingTier: snapshot.testingTier,
    setActiveModel: useCallback((tier: Parameters<typeof setActiveAiModel>[0]) => void setActiveAiModel(tier), []),
    reindex: useCallback(() => void reindexAiLibrary(), []),
    pauseIndex: useCallback(() => void pauseAiIndex(), []),
    resumeIndex: useCallback(() => void resumeAiIndex(), []),
    cancelDownload: useCallback(() => void cancelAiDownload(), []),
    pauseDownload: useCallback(() => void pauseAiDownload(), []),
    resumeDownload: useCallback(() => void resumeAiDownload(), []),
    updateResourcePreset: useCallback((preset: number) => void updateAiResourcePreset(preset), []),
    updateSearchStrictness: useCallback((value: number) => void updateAiSearchStrictness(value), []),
    updateModel: useCallback((tier: Parameters<typeof updateAiModel>[0]) => void updateAiModel(tier), []),
    refresh: useCallback(() => void refreshAiSettings(), [])
  };
}
