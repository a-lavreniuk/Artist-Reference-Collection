import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getCardMediaRel, resolveCardMediaUrl } from './cardMediaService';
import { isMcpToolEnabled } from './mcpToolAccess';
import { ensureLibraryReady } from '../storage/libraryStorage';
import { assertMcpReadAccess, buildMcpDeps } from './mcpDeps';

async function readCardResource(
  cardId: string,
  variant: 'thumb' | 'original'
): Promise<{ uri: string; mimeType: string; text: string }> {
  const deps = buildMcpDeps();
  assertMcpReadAccess(deps);
  const root = deps.getLibraryRoot();
  if (!root) throw new Error('Библиотека не выбрана');
  await ensureLibraryReady(root);
  const url = await resolveCardMediaUrl(root, cardId, variant);
  if (!url) throw new Error('Медиа недоступно');
  const rel = await getCardMediaRel(root, cardId, variant);
  return {
    uri: `arc://card/${cardId}/${variant}`,
    mimeType: 'text/plain',
    text: JSON.stringify({ url, cardId, variant, rel }, null, 2)
  };
}

export function registerArcMcpResources(server: McpServer): void {
  if (!isMcpToolEnabled('arc_card_media_resources')) return;

  const thumbTemplate = new ResourceTemplate('arc://card/{cardId}/thumb', { list: undefined });
  server.registerResource(
    'arc_card_thumb',
    thumbTemplate,
    {
      title: 'Превью карточки',
      description: 'Локальный URL превью изображения карточки ARC'
    },
    async (uri, variables) => {
      const cardId = String(variables.cardId ?? '');
      const item = await readCardResource(cardId, 'thumb');
      return {
        contents: [{ uri: uri.href, mimeType: item.mimeType, text: item.text }]
      };
    }
  );

  const originalTemplate = new ResourceTemplate('arc://card/{cardId}/original', { list: undefined });
  server.registerResource(
    'arc_card_original',
    originalTemplate,
    {
      title: 'Оригинал карточки',
      description: 'Локальный URL оригинального файла карточки ARC'
    },
    async (uri, variables) => {
      const cardId = String(variables.cardId ?? '');
      const item = await readCardResource(cardId, 'original');
      return {
        contents: [{ uri: uri.href, mimeType: item.mimeType, text: item.text }]
      };
    }
  );
}
