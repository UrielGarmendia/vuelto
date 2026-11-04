import { expect, test, type Page } from '@playwright/test';

async function add(page: Page, kind: 'Gasto' | 'Ingreso', digits: string, category: string) {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const dialog = page.getByRole('dialog');
  if (kind === 'Ingreso') await dialog.getByRole('radio', { name: 'Ingreso' }).click();
  for (const d of digits) await dialog.getByRole('button', { name: d, exact: true }).click();
  await dialog.getByRole('radio', { name: category }).click();
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
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

    const balance = page.getByRole('region', { name: 'Tu saldo' });
    await expect(balance).toContainText('$ 477.250');
    await expect(page.getByText('Gastado en')).toBeVisible();
    await expect(page.getByRole('region', { name: /Lo que más gastaste/ })).toContainText(
      'Supermercado',
    );
    await expect(
      page.getByRole('region', { name: 'Últimos movimientos' }).getByRole('link'),
    ).toHaveCount(5);
    await expect(page.getByRole('status')).toBeHidden({ timeout: 7000 });
    await page.screenshot({
      path: `e2e/__screenshots__/${info.project.name}/inicio-datos-${theme}.png`,
      fullPage: true,
    });
  });
}
