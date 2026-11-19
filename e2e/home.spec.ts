import { expect, test, type Page } from './fixtures';

async function add(page: Page, kind: 'Gasto' | 'Ingreso', digits: string, category: string) {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const dialog = page.getByRole('dialog');
  if (kind === 'Ingreso') await dialog.getByRole('radio', { name: 'Ingreso' }).click();
  for (const d of digits) await dialog.getByRole('button', { name: d, exact: true }).click();
  await dialog.getByRole('radio', { name: category }).click();
  await dialog.getByRole('button', { name: /^Guardar (gasto|ingreso)$/ }).click();
  await expect(dialog).toBeHidden();
}

for (const theme of ['light', 'dark'] as const) {
  test(`home dashboard summarizes the month (${theme})`, async ({ page }, info) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true, theme: t }, version: 0 }),
      );
    }, theme);
    await page.goto('/');
    await add(page, 'Ingreso', '500000', 'Sueldo');
    await add(page, 'Gasto', '18450', 'Supermercado');
    await add(page, 'Gasto', '3200', 'Comida afuera');
    await add(page, 'Gasto', '1100', 'Transporte');

    const balance = page.getByRole('region', { name: 'Disponible' });
    await expect(balance.getByRole('img', { name: '$ 477.250' })).toBeVisible();
    await expect(balance).toContainText('Salió$ 22.750');
    const surplus = page.getByRole('region', { name: 'Este mes te sobran' });
    await expect(surplus).toContainText('$ 477.250');
    await expect(surplus).toContainText('Podrías invertir hasta $ 477.250');
    // Four movements in a week are not enough to say anything yet.
    await expect(page.getByText('Cargá un par de semanas y empiezo a darte datos.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cómo viene el mes' })).toContainText(
      'gastado en',
    );
    await expect(
      page.getByRole('region', { name: 'Últimos movimientos' }).getByRole('link'),
    ).toHaveCount(5);

    // Picking today on the dial lists that day's movements.
    const dial = page.getByRole('slider', { name: 'Día del mes' });
    await dial.focus();
    await page.keyboard.press('End');
    await expect(dial).toHaveAttribute('aria-valuetext', /: \$\s22\.750$/);
    await expect(page.getByRole('heading', { name: '4 movimientos' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver el mes' }).click();
    await expect(page.getByText('gastado en', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden({ timeout: 7000 });
    await page.screenshot({
      path: `e2e/__screenshots__/${info.project.name}/inicio-datos-${theme}.png`,
      fullPage: true,
    });
  });
}

test('the dollar block shows MEP and blue with their change since the day before', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('vuelto-prefs'))
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true }, version: 0 }),
      );
  });
  await page.goto('/');
  const block = page.getByRole('region', { name: 'Dólar' });
  await expect(block).toContainText('MEP$ 1.210');
  await expect(block).toContainText('Blue$ 1.230');
  await expect(block).toContainText('sin dato de ayer');

  // Yesterday's close on record: today shows how it moved.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('vuelto');
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite');
          const store = tx.objectStore('kv');
          const get = store.get('rates-history');
          get.onsuccess = () => {
            const d = new Date(Date.now() - 86_400_000);
            const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            store.put({
              key: 'rates-history',
              value: { ...(get.result?.value ?? {}), [day]: { mep: 1200, blue: 1250 } },
            });
          };
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(block).toContainText('▲ +0,83 %');
  await expect(block).toContainText('▼ −1,60 %');
});
