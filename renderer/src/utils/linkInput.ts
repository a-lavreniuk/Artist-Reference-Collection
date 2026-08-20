export type LinkProtocol = 'http://' | 'https://';

export type ParsedLinkInput = {
  protocol: LinkProtocol;
  host: string;
};

export const DEFAULT_LINK_PROTOCOL: LinkProtocol = 'https://';

const PROTOCOL_RE = /^(https?:\/\/)/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function stripEdgeSlashes(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function parseLinkInput(raw: string): ParsedLinkInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { protocol: DEFAULT_LINK_PROTOCOL, host: '' };
  }

  const match = PROTOCOL_RE.exec(trimmed);
  const protocol: LinkProtocol = match?.[1]?.toLowerCase() === 'http://' ? 'http://' : DEFAULT_LINK_PROTOCOL;
  const rest = match ? trimmed.slice(match[0].length) : trimmed;
  return {
    protocol,
    host: stripEdgeSlashes(rest.trim())
  };
}

export function normalizeLinkInputValue(raw: string): string {
  const { protocol, host } = parseLinkInput(raw);
  if (!host) return '';
  return `${protocol}${host}`;
}

export function hostDraftToStoredValue(protocol: LinkProtocol, hostDraft: string): string {
  const trimmed = hostDraft.trim();
  if (!trimmed) return '';
  if (PROTOCOL_RE.test(trimmed)) {
    return normalizeLinkInputValue(trimmed);
  }
  return normalizeLinkInputValue(`${protocol}${trimmed}`);
}

function isHttpHostname(host: string): boolean {
  if (!host || host.includes(' ')) return false;
  if (host === 'localhost') return true;
  if (host.includes(':')) return true;
  if (IPV4_RE.test(host)) return true;
  return host.includes('.');
}

/** Пустое значение допустимо. Непустая строка должна быть http(s)-ссылкой с хостом. */
export function isValidLinkInputValue(raw: string): boolean {
  const normalized = normalizeLinkInputValue(raw);
  if (!normalized) return true;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return isHttpHostname(url.hostname);
  } catch {
    return false;
  }
}

export function toOpenableLinkUrl(raw: string): string | null {
  const normalized = normalizeLinkInputValue(raw);
  if (!normalized || !isValidLinkInputValue(normalized)) return null;
  return normalized;
}
