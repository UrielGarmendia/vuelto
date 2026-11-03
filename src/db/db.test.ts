import { afterEach, describe, expect, it } from 'vitest';
import { VueltoDB } from './db';

let db: VueltoDB;
afterEach(() => db.delete());

describe('VueltoDB', () => {
  it('seeds categories and accounts on first open', async () => {
    db = new VueltoDB('test-seed');
    await db.open();
    expect(await db.categories.where('type').equals('expense').count()).toBe(18);
    expect(await db.categories.where('type').equals('income').count()).toBe(3);
    expect(await db.accounts.count()).toBe(4);
    expect(await db.categories.where('synced').equals(0).count()).toBe(21);
  });

  it('does not seed twice', async () => {
    db = new VueltoDB('test-reopen');
    await db.open();
    db.close();
    await db.open();
    expect(await db.accounts.count()).toBe(4);
  });

  it('queries transactions by account and date range', async () => {
    db = new VueltoDB('test-index');
    const [acc] = await db.accounts.orderBy('order').toArray();
    const accountId = acc!.id;
    const base = {
      type: 'expense',
      currency: 'ARS',
      tags: [] as string[],
      deleted: 0,
      synced: 0,
      createdAt: 1,
      updatedAt: 1,
    } as const;
    await db.transactions.bulkAdd([
      { ...base, id: 'a', amountCents: 100, date: '2026-10-31', accountId },
      { ...base, id: 'b', amountCents: 200, date: '2026-11-02', accountId },
    ]);
    const nov = await db.transactions
      .where('[accountId+date]')
      .between([accountId, '2026-11-01'], [accountId, '2026-11-30'], true, true)
      .toArray();
    expect(nov.map((t) => t.id)).toEqual(['b']);
  });
});
