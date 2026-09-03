/**
 * HTTP Import API used by the browser extension downloads media but never
 * writes card fields (name, link, description, custom fields).
 * Incoming name/website from old extension queues are ignored.
 */
export function mediaOptionsForHttpExtensionImport(_incoming?: {
  name?: string;
  website?: string;
}): Record<string, never> {
  return {};
}
