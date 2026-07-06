import { ensureLibraryReady } from '../storage/libraryStorage';
import {
  assertMcpReadAccess,
  assertMcpWriteAccess,
  mcpToolError,
  mcpToolJson,
  type McpDeps
} from './mcpDeps';

export async function runMcpRead<T>(
  deps: McpDeps,
  fn: (root: string) => T | Promise<T>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }> {
  try {
    assertMcpReadAccess(deps);
    const root = deps.getLibraryRoot();
    if (!root) {
      return mcpToolError('Библиотека не выбрана');
    }
    await ensureLibraryReady(root);
    return mcpToolJson(await fn(root));
  } catch (err) {
    return mcpToolError(err instanceof Error ? err.message : String(err));
  }
}

export async function runMcpWrite<T>(
  deps: McpDeps,
  fn: (root: string) => T | Promise<T>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }> {
  try {
    const root = assertMcpWriteAccess(deps);
    await ensureLibraryReady(root);
    return mcpToolJson(await fn(root));
  } catch (err) {
    return mcpToolError(err instanceof Error ? err.message : String(err));
  }
}

export async function runMcpWriteRoot(
  deps: McpDeps
): Promise<
  | { ok: true; root: string }
  | { ok: false; result: { content: Array<{ type: 'text'; text: string }>; isError: true } }
> {
  try {
    const root = assertMcpWriteAccess(deps);
    await ensureLibraryReady(root);
    return { ok: true, root };
  } catch (err) {
    return { ok: false, result: mcpToolError(err instanceof Error ? err.message : String(err)) };
  }
}
