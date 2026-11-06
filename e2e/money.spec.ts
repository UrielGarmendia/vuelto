import { expect, test, type Page } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
});

const sheet = (page: Page) => page.getByRole('dialog');
const rows = (page: Page) =>
  page.getByRole('region', { name: 'Lista de movimientos' }).getByRole('link');

async function open(page: Page, digits: string) {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const pad = sheet(page).getByRole('group', { name: 'Teclado numérico' });
  for (const d of digits) await pad.getByRole('button', { name: d, exact: true }).click();
}

test('a transfer moves money between accounts without changing the total', async ({ page }) => {
  await page.goto('/movimientos');
  await open(page, '1000');
  await sheet(page).getByRole('radio', { name: 'Transferencia' }).click();
  await sheet(page).getByLabel('Desde').selectOption({ label: 'Banco' });
  await sheet(page).getByLabel('Hacia').selectOption({ label: 'Efectivo' });
  await sheet(page).getByRole('button', { name: 'Guardar transferencia' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(rows(page).first()).toContainText('Transferencia');
  await expect(rows(page).first()).toContainText('Banco → Efectivo');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Disponible' })).toContainText('$ 0');
});

test('a card purchase in installments creates linked movements', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/movimientos');
  await open(page, '3000');
  await sheet(page).getByRole('radio', { name: 'Supermercado' }).click();
  await sheet(page).getByLabel('Cuenta').selectOption({ label: 'Tarjeta de crédito' });
  await sheet(page).getByLabel('Cuotas').selectOption('3');
  await expect(sheet(page)).toContainText('3 cuotas de $ 1.000');
  await sheet(page).getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(rows(page).filter({ hasText: /cuota \d\/3/ })).toHaveCount(3);

  await rows(page).filter({ hasText: 'cuota 1/3' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: 'Todas las cuotas' }).click();
  await expect(page).toHaveURL(/\/movimientos$/);
  await expect(rows(page)).toHaveCount(0);
});

test('a repeating movement fills in the occurrences that came due', async ({ page }) => {
  await page.goto('/movimientos');
  await open(page, '500');
  await sheet(page).getByRole('radio', { name: 'Suscripciones' }).click();
  // Started 15 days ago, weekly: today the app owes two more.
  const start = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await sheet(page).getByLabel('Elegir fecha').fill(start);
  await sheet(page).getByLabel('Repetir').selectOption({ label: 'Cada semana' });
  await sheet(page).getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(sheet(page)).toBeHidden();
  await page.reload();
  await expect(rows(page).filter({ hasText: 'se repite' })).toHaveCount(3);

  await page.goto('/ajustes/recurrentes');
  await expect(page.getByText(/cada semana · próximo/)).toBeVisible();
});

test('a category budget warns at 80 % and feeds the dial', async ({ page }) => {
  await page.goto('/ajustes/presupuestos');
  await page.getByRole('button', { name: /Supermercado/ }).click();
  await page.getByLabel('Presupuesto mensual de Supermercado').fill('1000');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Supermercado/ })).toContainText('de $ 1.000');

  await open(page, '850');
  await sheet(page).getByRole('radio', { name: 'Supermercado' }).click();
  await sheet(page).getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(page.getByRole('status')).toContainText('80 % del presupuesto de Supermercado');

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Cómo viene el mes' })).toContainText(
    'del presupuesto',
  );
});

test('a dollar movement keeps the rate of its day', async ({ page }) => {
  await page.goto('/ajustes/cuentas');
  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  const dialog = sheet(page);
  await dialog.getByLabel('Nombre').fill('Ahorro');
  await dialog.getByRole('radio', { name: 'USD' }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/movimientos');
  await open(page, '10');
  await sheet(page).getByLabel('Cuenta').selectOption({ label: 'Ahorro (USD)' });
  await expect(sheet(page)).toContainText('≈ $ 12.100 al dólar MEP');
  await sheet(page).getByRole('radio', { name: 'Salidas' }).click();
  await sheet(page).getByRole('button', { name: 'Guardar gasto' }).click();
  await rows(page).first().click();
  await expect(page.getByText(/\$\s12\.100 \(dólar a \$\s1\.210\)/)).toBeVisible();
});

test('a favorite fills the sheet with one tap', async ({ page }) => {
  await page.goto('/movimientos');
  await open(page, '1500');
  await sheet(page).getByRole('radio', { name: 'Comida afuera' }).click();
  await sheet(page).getByRole('button', { name: 'Nota' }).click();
  await sheet(page).getByLabel('Nota').fill('Café');
  await sheet(page).getByRole('button', { name: 'Favorito' }).click();
  await sheet(page).getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(sheet(page)).toBeHidden();

  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  await sheet(page)
    .getByRole('group', { name: 'Favoritos' })
    .getByRole('button', { name: /Café/ })
    .click();
  await expect(sheet(page).getByLabel(/^Monto/)).toHaveAttribute('aria-label', /1\.500/);
  await sheet(page).getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(rows(page).filter({ hasText: 'Café' })).toHaveCount(2);
});
