/** Fixed port for browser extension Import API (Eagle uses 41595). */
export const ARC_IMPORT_API_PORT = 47896;

export const ARC_IMPORT_API_HOST = '127.0.0.1';

export const ARC_IMPORT_API_BASE = `http://${ARC_IMPORT_API_HOST}:${ARC_IMPORT_API_PORT}/api/v1`;

export const MAX_IMPORT_BODY_BYTES = 32 * 1024 * 1024;
