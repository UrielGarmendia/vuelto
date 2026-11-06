import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
});

test('a savings goal fills up and shows on Inicio', async ({ page }) => {
  await page.goto('/ajustes/metas');
  await page.getByRole('button', { name: 'Nueva meta' }).click();
  await page.getByLabel('Nombre').fill('Vacaciones');
  await page.getByLabel('Objetivo').fill('100000');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await page.getByLabel('Monto para Vacaciones').fill('25000');
  await page.getByRole('button', { name: 'Sumar' }).click();
  await expect(page.getByText('$ 25.000 de $ 100.000')).toBeVisible();
  await expect(page.getByText('25 %')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Metas' })).toContainText('Vacaciones');
});

test('Inicio can hide and reorder its blocks', async ({ page }) => {
  await page.goto('/ajustes/inicio');
  const toggle = page.getByRole('switch', { name: 'Mostrar Dial del mes' });
  await page.locator('label', { has: toggle }).click();
  await expect(toggle).not.toBeChecked();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Cómo viene el mes' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Disponible' })).toBeVisible();
});
