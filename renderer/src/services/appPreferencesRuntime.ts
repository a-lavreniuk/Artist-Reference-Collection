import {
  defaultAppPreferences,
  getAppPreferences,
  setAppPreferences,
  type AppPreferencesV1,
  type ScreenshotFormat
} from './appPreferences';

let cache: AppPreferencesV1 | null = null;
let initPromise: Promise<AppPreferencesV1> | null = null;
let writeChain: Promise<AppPreferencesV1> = Promise.resolve(defaultAppPreferences());
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function sanitizeScreenshotFormat(raw: unknown): ScreenshotFormat {
  if (raw === 'png' || raw === 'jpg' || raw === 'webp') return raw;
  return 'webp';
}

function normalizePatch(patch: Partial<AppPreferencesV1>): Partial<AppPreferencesV1> {
  const next: Partial<AppPreferencesV1> = {};

  if ('launchAtLogin' in patch && typeof patch.launchAtLogin === 'boolean') {
    next.launchAtLogin = patch.launchAtLogin;
  }
  if ('closeToTrayOnWindowClose' in patch && typeof patch.closeToTrayOnWindowClose === 'boolean') {
    next.closeToTrayOnWindowClose = patch.closeToTrayOnWindowClose;
  }
  if ('importSourceFilesAction' in patch) {
    next.importSourceFilesAction = patch.importSourceFilesAction;
  }
  if ('deleteCardsUseTrash' in patch && typeof patch.deleteCardsUseTrash === 'boolean') {
    next.deleteCardsUseTrash = patch.deleteCardsUseTrash;
  }
  if ('screenshotsEnabled' in patch && typeof patch.screenshotsEnabled === 'boolean') {
    next.screenshotsEnabled = patch.screenshotsEnabled;
  }
  if ('screenshotFormat' in patch) {
    next.screenshotFormat = sanitizeScreenshotFormat(patch.screenshotFormat);
  }
  if ('screenshotAskSaveLocation' in patch && typeof patch.screenshotAskSaveLocation === 'boolean') {
    next.screenshotAskSaveLocation = patch.screenshotAskSaveLocation;
  }
  if ('screenshotPrefixName' in patch && typeof patch.screenshotPrefixName === 'boolean') {
    next.screenshotPrefixName = patch.screenshotPrefixName;
  }
  if ('screenshotRetina2x' in patch && typeof patch.screenshotRetina2x === 'boolean') {
    next.screenshotRetina2x = patch.screenshotRetina2x;
  }
  if ('notifyScreenshotSaved' in patch && typeof patch.notifyScreenshotSaved === 'boolean') {
    next.notifyScreenshotSaved = patch.notifyScreenshotSaved;
  }
  if ('notifyDuplicatesFound' in patch && typeof patch.notifyDuplicatesFound === 'boolean') {
    next.notifyDuplicatesFound = patch.notifyDuplicatesFound;
  }
  if ('notifyAutoImport' in patch && typeof patch.notifyAutoImport === 'boolean') {
    next.notifyAutoImport = patch.notifyAutoImport;
  }
  if ('notifyFilesAdded' in patch && typeof patch.notifyFilesAdded === 'boolean') {
    next.notifyFilesAdded = patch.notifyFilesAdded;
  }
  if ('notifySoundEnabled' in patch && typeof patch.notifySoundEnabled === 'boolean') {
    next.notifySoundEnabled = patch.notifySoundEnabled;
  }

  return next;
}

function applyPatchLocal(current: AppPreferencesV1, patch: Partial<AppPreferencesV1>): AppPreferencesV1 {
  const next: AppPreferencesV1 = { ...current, version: 1 };

  if ('launchAtLogin' in patch && typeof patch.launchAtLogin === 'boolean') {
    next.launchAtLogin = patch.launchAtLogin;
  }
  if ('closeToTrayOnWindowClose' in patch && typeof patch.closeToTrayOnWindowClose === 'boolean') {
    next.closeToTrayOnWindowClose = patch.closeToTrayOnWindowClose;
  }
  if ('importSourceFilesAction' in patch) {
    next.importSourceFilesAction = patch.importSourceFilesAction === 'trash' ? 'trash' : 'ask';
  }
  if ('deleteCardsUseTrash' in patch && typeof patch.deleteCardsUseTrash === 'boolean') {
    next.deleteCardsUseTrash = patch.deleteCardsUseTrash;
  }
  if ('screenshotsEnabled' in patch && typeof patch.screenshotsEnabled === 'boolean') {
    next.screenshotsEnabled = patch.screenshotsEnabled;
  }
  if ('screenshotFormat' in patch) {
    next.screenshotFormat = sanitizeScreenshotFormat(patch.screenshotFormat);
  }
  if ('screenshotAskSaveLocation' in patch && typeof patch.screenshotAskSaveLocation === 'boolean') {
    next.screenshotAskSaveLocation = patch.screenshotAskSaveLocation;
  }
  if ('screenshotPrefixName' in patch && typeof patch.screenshotPrefixName === 'boolean') {
    next.screenshotPrefixName = patch.screenshotPrefixName;
  }
  if ('screenshotRetina2x' in patch && typeof patch.screenshotRetina2x === 'boolean') {
    next.screenshotRetina2x = patch.screenshotRetina2x;
  }
  if ('notifyScreenshotSaved' in patch && typeof patch.notifyScreenshotSaved === 'boolean') {
    next.notifyScreenshotSaved = patch.notifyScreenshotSaved;
  }
  if ('notifyDuplicatesFound' in patch && typeof patch.notifyDuplicatesFound === 'boolean') {
    next.notifyDuplicatesFound = patch.notifyDuplicatesFound;
  }
  if ('notifyAutoImport' in patch && typeof patch.notifyAutoImport === 'boolean') {
    next.notifyAutoImport = patch.notifyAutoImport;
  }
  if ('notifyFilesAdded' in patch && typeof patch.notifyFilesAdded === 'boolean') {
    next.notifyFilesAdded = patch.notifyFilesAdded;
  }
  if ('notifySoundEnabled' in patch && typeof patch.notifySoundEnabled === 'boolean') {
    next.notifySoundEnabled = patch.notifySoundEnabled;
  }

  return next;
}

export async function initAppPreferencesRuntime(): Promise<AppPreferencesV1> {
  if (cache) return cache;
  if (!initPromise) {
    initPromise = getAppPreferences()
      .then((loaded) => {
        cache = loaded;
        notify();
        return loaded;
      })
      .catch(() => {
        cache = defaultAppPreferences();
        notify();
        return cache;
      });
  }
  return initPromise;
}

export function getAppPreferencesSync(): AppPreferencesV1 {
  return cache ?? defaultAppPreferences();
}

export async function patchAppPreferences(patch: Partial<AppPreferencesV1>): Promise<AppPreferencesV1> {
  const normalized = normalizePatch(patch);
  if (Object.keys(normalized).length === 0) {
    return getAppPreferencesSync();
  }

  const run = async (): Promise<AppPreferencesV1> => {
    try {
      const next = await setAppPreferences(normalized);
      cache = next;
      notify();
      return next;
    } catch {
      const next = applyPatchLocal(getAppPreferencesSync(), normalized);
      cache = next;
      notify();
      return next;
    }
  };

  writeChain = writeChain.then(run, run);
  return writeChain;
}

export function subscribeAppPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
