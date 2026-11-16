import { expect, test, type Page } from './fixtures';

const iso = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Past days straight into IndexedDB, and $ 1.300.000 in cash so today has its own value. */
async function seed(page: Page) {
  const rows = [
    [40, 100_000_000, 1000],
    [10, 150_000_000, 1000],
    [2, 120_000_000, undefined],
  ] as const;
  await page.evaluate(
    (days) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('vuelto');
        open.onsuccess = () => {
          const tx = open.result.transaction(['netWorth', 'accounts'], 'readwrite');
          for (const [date, total, rate] of days) {
            tx.objectStore('netWorth').put({
              id: date,
              date,
              createdAt: 0,
              updatedAt: 0,
              deleted: 0,
              synced: 0,
              accounts: [],
              availableCents: total,
              investedCents: 0,
              debtCents: 0,
              totalCents: total,
              ...(rate ? { usdRate: rate, totalUsdCents: Math.round(total / rate) } : {}),
            });
          }
          const accounts = tx.objectStore('accounts');
          const all = accounts.getAll();
          all.onsuccess = () => {
            const cash = (all.result as { name: string }[]).find((a) => a.name === 'Efectivo')!;
            accounts.put({ ...cash, initialBalanceCents: 130_000_000 });
          };
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    rows.map(([ago, total, rate]) => [iso(ago), total, rate] as const),
  );
}

for (const theme of ['light', 'dark'] as const) {
  test(`net worth draws its curve by range and currency (${theme})`, async ({ page }, info) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true, theme: t }, version: 0 }),
      );
    }, theme);
    await page.goto('/');
    await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
    await seed(page);
    await page.reload();

    const widget = page.getByRole('region', { name: 'Evolución del patrimonio' });
    await expect(widget).toContainText('$ 1.300.000');
    await widget.getByRole('link').click();
    await expect(page.getByRole('heading', { name: 'Patrimonio', level: 1 })).toBeVisible();

    const chart = page.getByRole('region', { name: 'Curva del patrimonio' });
    await expect(widget).toHaveCount(0);
    // Three months: from 1.000.000 forty days ago to 1.300.000 today.
    await expect(chart).toContainText('+$ 300.000');
    await expect(chart).toContainText('+30,00 %');
    await page.screenshot({
      path: `e2e/__screenshots__/${info.project.name}/patrimonio-${theme}.png`,
      fullPage: true,
    });

    await page.getByRole('radio', { name: 'el último mes' }).click();
    await expect(chart).toContainText('−$ 200.000');
    await page.getByRole('radio', { name: 'Dólares' }).click();
    await page.getByRole('radio', { name: 'todo el período' }).click();
    await expect(chart.getByRole('img', { name: /de US\$ 1\.000/ })).toBeVisible();
  });
}
