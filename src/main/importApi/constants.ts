/** Fixed port for browser extension Import API (Eagle uses 41595). */
export const ARC_IMPORT_API_PORT = 47896;

export const ARC_IMPORT_API_HOST = '127.0.0.1';

export const ARC_IMPORT_API_BASE = `http://${ARC_IMPORT_API_HOST}:${ARC_IMPORT_API_PORT}/api/v1`;

/** Max JSON request body size for Import API endpoints. */
export const MAX_IMPORT_BODY_BYTES = 32 * 1024 * 1024;

/** Remote video downloads (mp4, webm, HLS, YouTube via yt-dlp). */
export const MAX_IMPORT_VIDEO_BYTES = 512 * 1024 * 1024;

/** No byte cap for remote image downloads. */
export const MAX_IMPORT_IMAGE_BYTES = Number.POSITIVE_INFINITY;
