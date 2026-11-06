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

test('a shared expense keeps your part and tags filter the list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/movimientos');
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const sheet = page.getByRole('dialog');
  const pad = sheet.getByRole('group', { name: 'Teclado numérico' });
  for (const d of '9000') await pad.getByRole('button', { name: d, exact: true }).click();
  await sheet.getByRole('radio', { name: 'Comida afuera' }).click();
  await sheet.getByLabel('Dividir').selectOption('3');
  await expect(sheet).toContainText('Tu parte: $ 3.000 de $ 9.000 entre 3');
  await sheet.getByRole('button', { name: 'Nota' }).click();
  await sheet.getByLabel('Nota').fill('Asado #amigos');
  await sheet.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(sheet).toBeHidden();

  const list = page.getByRole('region', { name: 'Lista de movimientos' });
  await expect(list.getByRole('link').first()).toContainText('−$ 3.000');
  await list.getByRole('link').first().click();
  await expect(page.getByText('Tu parte de $ 9.000 entre 3')).toBeVisible();
  await page.getByRole('button', { name: '#amigos' }).click();
  await expect(page.getByRole('searchbox', { name: 'Buscar movimientos' })).toHaveValue('#amigos');
  await expect(list.getByRole('link')).toHaveCount(1);
});
