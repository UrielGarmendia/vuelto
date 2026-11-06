/** Anything synced: an id and the time of its last change (soft deletes included). */
export interface Versioned {
  id: string;
  updatedAt: number;
}

// Deterministic tie-break when two devices wrote at the same millisecond: compare the
// serialized records, so every device picks the same winner whatever the merge order.
const key = (r: Versioned) => JSON.stringify(r, Object.keys(r).sort());

function newer<T extends Versioned>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return key(a) >= key(b) ? a : b;
}

/**
 * Last write wins per id. Idempotent, commutative and associative, so devices converge no
 * matter how many times or in what order they merge. Callers drop the local `synced` flag
 * first, since it differs between devices.
 */
export function mergeRecords<T extends Versioned>(a: readonly T[], b: readonly T[]): T[] {
  const out = new Map<string, T>();
  for (const r of [...a, ...b]) {
    const prev = out.get(r.id);
    out.set(r.id, prev ? newer(prev, r) : r);
  }
  return [...out.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
