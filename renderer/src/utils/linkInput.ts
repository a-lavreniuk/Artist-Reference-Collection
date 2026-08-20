export type LinkProtocol = 'http://' | 'https://';

export type ParsedLinkInput = {
  protocol: LinkProtocol;
  host: string;
};

export const DEFAULT_LINK_PROTOCOL: LinkProtocol = 'https://';

const PROTOCOL_RE = /^(https?:\/\/)/i;

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
