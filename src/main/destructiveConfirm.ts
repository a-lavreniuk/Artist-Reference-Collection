import { randomBytes } from 'crypto';

export type DestructiveConfirmKind =
  | 'empty-trash'
  | 'permanent-delete-card'
  | 'delete-library-disk';

type ConfirmEntry = {
  kind: DestructiveConfirmKind;
  binding?: string;
  usesLeft: number;
  expiresAt: number;
};

const TTL_MS = 120_000;
const MAX_ENTRIES = 64;
const store = new Map<string, ConfirmEntry>();

function prune(now = Date.now()): void {
  for (const [token, entry] of store) {
    if (entry.expiresAt <= now || entry.usesLeft <= 0) store.delete(token);
  }
}

/**
 * Issue a short-lived confirmation token after the user confirms in UI.
 * `uses` > 1 — for bulk permanent delete of several cards with one modal.
 */
export function issueDestructiveConfirm(
  kind: DestructiveConfirmKind,
  opts?: { binding?: string; uses?: number }
): string {
  prune();
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
  const uses = Math.max(1, Math.min(500, Math.floor(opts?.uses ?? 1)));
  const token = randomBytes(16).toString('hex');
  const binding = typeof opts?.binding === 'string' && opts.binding.trim() ? opts.binding.trim() : undefined;
  store.set(token, {
    kind,
    binding,
    usesLeft: uses,
    expiresAt: Date.now() + TTL_MS
  });
  return token;
}

/** Consume one use. Returns false if token invalid, expired, wrong kind/binding. */
export function consumeDestructiveConfirm(
  token: unknown,
  kind: DestructiveConfirmKind,
  binding?: string
): boolean {
  if (typeof token !== 'string' || !token.trim()) return false;
  prune();
  const entry = store.get(token.trim());
  if (!entry) return false;
  if (entry.kind !== kind) return false;
  if (entry.binding != null) {
    if (typeof binding !== 'string' || binding.trim() !== entry.binding) return false;
  }
  entry.usesLeft -= 1;
  if (entry.usesLeft <= 0) store.delete(token.trim());
  return true;
}

/** Test helper. */
export function clearDestructiveConfirms(): void {
  store.clear();
}
