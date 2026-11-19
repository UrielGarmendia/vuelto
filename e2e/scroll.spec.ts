import { expect, test, type Page } from './fixtures';

const screens = [
  { path: '/', heading: 'Disponible' },
  { path: '/movimientos', heading: 'Movimientos' },
  { path: '/estadisticas', heading: 'Estadísticas' },
  { path: '/ajustes', heading: 'Ajustes' },
  { path: '/patrimonio', heading: 'Patrimonio' },
  { path: '/ajustes/reglas', heading: 'Reglas de categorías' },
];

/** Enough movements for every screen to scroll. */
async function seed(page: Page) {
  await page.goto('/movimientos');
  await expect(page.getByRole('button', { name: 'Cargar movimiento' })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('vuelto');
        open.onsuccess = () => {
          const tx = open.result.transaction(
            ['transactions', 'categories', 'accounts'],
            'readwrite',
          );
          const cats = tx.objectStore('categories').getAll();
          const accs = tx.objectStore('accounts').getAll();
          accs.onsuccess = () => {
            const expense = (cats.result as { id: string; type: string }[]).filter(
              (c) => c.type === 'expense',
            );
            const account = (accs.result as { id: string }[])[0]!.id;
            const now = Date.now();
            for (let i = 0; i < 80; i++) {
              const d = new Date(now - i * 86_400_000 * 0.7);
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              tx.objectStore('transactions').put({
                id: `seed-${i}`,
                createdAt: now,
                updatedAt: now,
                deleted: 0,
                synced: 0,
                type: 'expense',
                amountCents: 150_000 + i * 1_000,
                currency: 'ARS',
                date,
                categoryId: expense[i % expense.length]!.id,
                accountId: account,
                tags: [],
              });
            }
          };
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
  await seed(page);
});

const settledScroll = async (page: Page) => {
  // Late effects (lazy routes, fonts, measured lists) get a moment to move the page.
  await page.waitForTimeout(800);
  return page.evaluate(() => window.scrollY);
};

test('every screen opens at the top when loaded directly', async ({ page }) => {
  for (const s of screens) {
    await page.goto(s.path);
    await expect(
      page
        .getByRole('heading', { name: s.heading })
        .or(page.getByText(s.heading, { exact: true }))
        .first(),
    ).toBeVisible();
    expect(await settledScroll(page), s.path).toBe(0);
  }
});

test('navigating to a screen opens it at the top, going back restores', async ({ page }) => {
  await page.goto('/movimientos');
  await expect(page.getByRole('region', { name: 'Lista de movimientos' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  const nav = page.getByRole('navigation', { name: 'Principal' }).filter({ visible: true });
  for (const name of ['Ajustes', 'Estadísticas', 'Inicio']) {
    await nav.getByRole('link', { name }).click();
    expect(await settledScroll(page), name).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 400));
  }
  await nav.getByRole('link', { name: 'Movimientos' }).click();
  expect(await settledScroll(page), 'Movimientos').toBe(0);
});

test('reopening or reloading the app starts at the top, not where it was left', async ({
  page,
}) => {
  for (const path of ['/ajustes', '/movimientos', '/']) {
    await page.goto(path);
    await page.waitForTimeout(500);
    // As far as the screen allows (wide screens may barely scroll).
    const room = await page.evaluate(() => {
      const room = Math.min(400, document.documentElement.scrollHeight - innerHeight);
      window.scrollTo(0, room);
      return room;
    });
    if (room < 20) continue;
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(10);
    await page.reload();
    expect(await settledScroll(page), path).toBe(0);
  }
});

test('weekday spending keeps its natural height next to the calendar', async ({ page }) => {
  await page.goto('/estadisticas');
  const weekday = page.getByRole('region', { name: 'Por día de la semana' });
  await expect(weekday).toBeVisible();
  const box = (await weekday.boundingBox())!;
  const content = await weekday.evaluate((el) =>
    [...el.children].reduce((h, c) => h + c.getBoundingClientRect().height, 0),
  );
  // Padding and gaps only: no empty band below the bars.
  expect(box.height - content).toBeLessThan(90);
});
