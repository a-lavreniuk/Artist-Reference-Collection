export type JSendSuccess<T> = { status: 'success'; data: T };
export type JSendError = { status: 'error'; message: string };
export type JSendResponse<T = unknown> = JSendSuccess<T> | JSendError;

export type ItemAddRequestBody = {
  url?: string;
  base64?: string;
  website?: string;
  pageTitle?: string;
  name?: string;
  collectionId?: string;
  quiet?: boolean;
};

export type CollectionEnsureRequestBody = {
  name?: string;
  description?: string;
};

export type AppInfoData = {
  name: string;
  version: string;
  platform: string;
  importApiEnabled: boolean;
  importApiPort: number;
};

export type ImportApiHandlerDeps = {
  getAppVersion: () => string;
  getPlatform: () => string;
  getLibraryRoot: () => string | null;
  isApiEnabled: () => boolean;
  resolveCardName: (pageTitle?: string, explicitName?: string) => string | undefined;
  importFromUrl: (args: {
    libraryRoot: string;
    url: string;
    website?: string;
    name?: string;
    collectionId?: string;
    quiet?: boolean;
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  ensureCollection: (args: {
    libraryRoot: string;
    name: string;
    description?: string;
  }) => Promise<{ ok: true; id: string; name: string; created: boolean } | { ok: false; error: string }>;
};
