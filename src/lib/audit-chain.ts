// Tamper-evident, hash-chained case-action log via the Web Crypto API
// (SubtleCrypto SHA-256). Each entry's hash covers its own fields plus the
// previous entry's hash, so any edit or reorder breaks the chain — the same
// principle blockchains use for immutable ledgers, applied client-side to a
// revenue-protection audit trail with no server involved.

export interface AuditEntry {
  seq: number;
  action: string;
  actor: string;
  at: string;
  prevHash: string;
  hash: string;
}

const GENESIS_HASH = "0".repeat(64);

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function entryPayload(seq: number, action: string, actor: string, at: string, prevHash: string): string {
  return `${seq}|${action}|${actor}|${at}|${prevHash}`;
}

export async function appendAuditEntry(chain: AuditEntry[], action: string, actor: string): Promise<AuditEntry[]> {
  const prevHash = chain.length ? chain[chain.length - 1].hash : GENESIS_HASH;
  const seq = chain.length;
  const at = new Date().toISOString();
  const hash = await sha256Hex(entryPayload(seq, action, actor, at, prevHash));
  return [...chain, { seq, action, actor, at, prevHash, hash }];
}

/** Recomputes every hash from scratch and confirms the chain hasn't been altered. */
export async function verifyAuditChain(chain: AuditEntry[]): Promise<boolean> {
  let prevHash = GENESIS_HASH;
  for (const entry of chain) {
    const expected = await sha256Hex(entryPayload(entry.seq, entry.action, entry.actor, entry.at, prevHash));
    if (expected !== entry.hash || entry.prevHash !== prevHash) return false;
    prevHash = entry.hash;
  }
  return true;
}
