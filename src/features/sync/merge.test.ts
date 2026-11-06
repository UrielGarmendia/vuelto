import { describe, expect, it } from 'vitest';
import { mergeRecords } from './merge';

type R = { id: string; updatedAt: number; v: string; deleted?: 0 | 1 };

// Small seeded generator: lots of overlapping ids and equal timestamps on purpose.
function sample(seed: number, n = 12): R[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const byId = new Map<string, R>();
  for (let i = 0; i < n; i++) {
    const r = {
      id: `r${Math.floor(rnd() * 6)}`,
      updatedAt: Math.floor(rnd() * 4),
      v: String.fromCharCode(97 + Math.floor(rnd() * 5)),
      ...(rnd() < 0.3 ? { deleted: 1 as const } : {}),
    };
    byId.set(r.id, r);
  }
  return [...byId.values()];
}

describe('mergeRecords', () => {
  const sets = Array.from({ length: 40 }, (_, i) => sample(i + 1));

  it('keeps the latest version of each record, deletions included', () => {
    const merged = mergeRecords(
      [
        { id: 'a', updatedAt: 1, v: 'old' },
        { id: 'b', updatedAt: 5, v: 'kept' },
      ],
      [
        { id: 'a', updatedAt: 2, v: 'gone', deleted: 1 },
        { id: 'c', updatedAt: 1, v: 'new' },
      ] as R[],
    );
    expect(merged).toEqual([
      { id: 'a', updatedAt: 2, v: 'gone', deleted: 1 },
      { id: 'b', updatedAt: 5, v: 'kept' },
      { id: 'c', updatedAt: 1, v: 'new' },
    ]);
  });

  it('is idempotent', () => {
    for (const a of sets) expect(mergeRecords(a, a)).toEqual(mergeRecords(a, []));
    for (let i = 1; i < sets.length; i++) {
      const once = mergeRecords(sets[i - 1]!, sets[i]!);
      expect(mergeRecords(once, sets[i]!)).toEqual(once);
    }
  });

  it('is commutative, even with equal timestamps', () => {
    for (let i = 1; i < sets.length; i++)
      expect(mergeRecords(sets[i]!, sets[i - 1]!)).toEqual(mergeRecords(sets[i - 1]!, sets[i]!));
  });

  it('is associative', () => {
    for (let i = 2; i < sets.length; i++) {
      const [a, b, c] = [sets[i - 2]!, sets[i - 1]!, sets[i]!];
      expect(mergeRecords(mergeRecords(a, b), c)).toEqual(mergeRecords(a, mergeRecords(b, c)));
    }
  });
});
