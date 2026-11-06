import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('vuelto-prefs'))
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true }, version: 0 }),
      );
  });
});

test('creates, edits, archives and restores a category', async ({ page }) => {
  await page.goto('/ajustes');
  await page.getByRole('link', { name: /Categorías/ }).click();
  await expect(page.getByRole('heading', { name: 'Categorías' })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre').fill('Café');
  await dialog.getByRole('radio', { name: 'Café' }).click(); // icon
  await dialog.getByRole('radio', { name: 'Mostaza' }).click(); // color
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('listitem', { name: 'Café' })).toBeVisible();

  // It shows up when loading an expense.
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  await expect(page.getByRole('dialog').getByRole('radio', { name: 'Café' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('listitem', { name: 'Café' }).getByRole('button').click();
  await dialog.getByLabel('Nombre').fill('Café y facturas');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem', { name: 'Café y facturas' })).toBeVisible();

  await page.getByRole('listitem', { name: 'Café y facturas' }).getByRole('button').click();
  await dialog.getByRole('button', { name: 'Archivar' }).click();
  const archived = page.getByRole('region', { name: 'Archivadas' });
  await expect(archived).toContainText('Café y facturas');
  await archived.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByRole('listitem', { name: 'Café y facturas' })).toBeVisible();
});

test('reorders categories with the keyboard and keeps the order', async ({ page }) => {
  await page.goto('/ajustes/categorias');
  const items = page.getByRole('listitem');
  await expect(items.first()).toHaveAccessibleName('Supermercado');
  await items.first().focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(items.nth(1)).toHaveAccessibleName('Supermercado');
  // Wait until the debounced save has reached IndexedDB, then reload.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            const open = indexedDB.open('vuelto');
            open.onsuccess = () => {
              const req = open.result.transaction('categories').objectStore('categories').getAll();
              req.onsuccess = () => {
                const rows = (req.result as { name: string; order: number; type: string }[])
                  .filter((c) => c.type === 'expense')
                  .sort((a, b) => a.order - b.order);
                open.result.close();
                resolve(rows[0]?.name ?? '');
              };
            };
          }),
      ),
    )
    .toBe('Comida afuera');
  await page.reload();
  await expect(items.first()).toHaveAccessibleName('Comida afuera');
  await expect(items.nth(1)).toHaveAccessibleName('Supermercado');
});

test('a credit card created with debt lowers the balance', async ({ page }, info) => {
  await page.goto('/ajustes/cuentas');
  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre').fill('Visa');
  await dialog.getByRole('radio', { name: 'Tarjeta de crédito' }).click();
  await dialog.getByLabel('Deuda actual').fill('15.000');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem', { name: /Visa, -\$\s15\.000/ })).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden({ timeout: 7000 });
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/cuentas-light.png` });

  await page.goto('/');
  const balance = page.getByRole('region', { name: 'Disponible' });
  await expect(balance).toContainText('Tarjeta$ 15.000');
  await expect(balance).toContainText(/te quedan −\$\s15\.000/);
});

test('rejects an invalid initial balance', async ({ page }) => {
  await page.goto('/ajustes/cuentas');
  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre').fill('Caja');
  await dialog.getByLabel('Saldo inicial').fill('12,345');
  await expect(dialog.getByRole('button', { name: 'Guardar' })).toBeDisabled();
});

for (const theme of ['light', 'dark'] as const) {
  test(`screenshots: categories and accounts (${theme})`, async ({ page }, info) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true, theme: t }, version: 0 }),
      );
    }, theme);
    const dir = `e2e/__screenshots__/${info.project.name}`;
    await page.goto('/ajustes/categorias');
    await expect(page.getByRole('listitem').first()).toBeVisible();
    await page.screenshot({ path: `${dir}/categorias-${theme}.png` });
    await page.getByRole('listitem').first().getByRole('button').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/categoria-sheet-${theme}.png` });
    await page.goto('/ajustes/cuentas');
    await expect(page.getByRole('listitem').first()).toBeVisible();
    await page.screenshot({ path: `${dir}/cuentas-${theme}.png` });
  });
}
