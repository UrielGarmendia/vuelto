import { expect, test, type Page } from './fixtures';

/** A visible amount: "$ 1.234" or "US$ 50" with digits. */
const AMOUNT = /\$\s?\d/;

async function addExpense(page: Page, digits: string) {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const sheet = page.getByRole('dialog');
  const pad = sheet.getByRole('group', { name: 'Teclado numérico' });
  for (const d of digits) await pad.getByRole('button', { name: d, exact: true }).click();
  await sheet.getByRole('radio', { name: 'Supermercado' }).click();
  await sheet.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(sheet).toBeHidden();
}

const eye = (page: Page, name: 'Ocultar montos' | 'Mostrar montos') =>
  page.getByRole('button', { name }).filter({ visible: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('vuelto-prefs'))
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true }, version: 0 }),
      );
  });
});

test('private mode hides every amount, is remembered and keeps what you were typing', async ({
  page,
}, info) => {
  await page.goto('/movimientos');
  await addExpense(page, '18450');

  await page.goto('/');
  const balance = page.getByRole('region', { name: 'Disponible' });
  await expect(balance).toContainText(AMOUNT);
  await eye(page, 'Ocultar montos').click();
  await expect(balance).toContainText('••••');
  await expect(balance).not.toContainText(AMOUNT);
  await expect(page.locator('main')).not.toContainText(AMOUNT);
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/privado.png` });

  // Remembered after a reload, everywhere.
  await page.reload();
  await expect(balance).toContainText('••••');
  for (const path of ['/movimientos', '/estadisticas', '/ajustes/cuentas']) {
    await page.goto(path);
    await expect(page.locator('main')).toContainText('••••');
    await expect(page.locator('main')).not.toContainText(AMOUNT);
  }

  // A half-written form survives the switch: nothing is remounted.
  await page.goto('/ajustes/metas');
  await page.getByRole('button', { name: 'Nueva meta' }).click();
  await page.getByLabel('Nombre').fill('Viaje a Bariloche');
  await eye(page, 'Mostrar montos').click();
  await expect(page.getByLabel('Nombre')).toHaveValue('Viaje a Bariloche');

  // The keyboard shortcut (outside inputs) toggles it too.
  await page.locator('h1').click();
  await page.keyboard.press('h');
  await expect(eye(page, 'Mostrar montos')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('h');
  await expect(eye(page, 'Ocultar montos')).toHaveAttribute('aria-pressed', 'false');
});
