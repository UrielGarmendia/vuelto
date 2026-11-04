import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('vuelto-prefs'))
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true }, version: 0 }),
      );
  });
});

async function addExpense(page: Page, digits: string, category: string) {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const dialog = page.getByRole('dialog');
  for (const d of digits) await dialog.getByRole('button', { name: d, exact: true }).click();
  await dialog.getByRole('radio', { name: category }).click();
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('export, wipe and restore a backup end to end', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '1250', 'Supermercado');
  await addExpense(page, '800', 'Transporte');

  await page.goto('/ajustes');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar backup/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^vuelto-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const json = JSON.parse(await readFile(file, 'utf8'));
  expect(json.tables.transactions).toHaveLength(2);

  // Wipe, guarded by typing the word.
  await page.getByRole('button', { name: 'Borrar todo' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Borrar todo' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Escribí BORRAR/).fill('borrar');
  await confirm.click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/movimientos');
  await expect(page.getByText('Todavía no hay movimientos')).toBeVisible();

  // Restore from the exported file.
  await page.goto('/ajustes');
  await page.getByLabel('Archivo de backup').setInputFiles(file);
  await expect(dialog).toContainText('2 movimientos');
  await dialog.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByRole('status')).toContainText('Backup restaurado');
  await page.goto('/movimientos');
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(2);
});

test('rejects a file that is not a Vuelto backup', async ({ page }) => {
  await page.goto('/ajustes');
  await page.getByLabel('Archivo de backup').setInputFiles({
    name: 'otra-cosa.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hola: 'mundo' })),
  });
  await expect(page.getByRole('status')).toContainText('No es un backup de Vuelto');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('exports transactions as CSV', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '1250', 'Supermercado');
  await page.goto('/ajustes');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar movimientos/ }).click();
  const csv = await readFile(await (await downloadPromise).path(), 'utf8');
  expect(csv).toContain('Fecha;Tipo;Monto;Moneda;Categoría;Cuenta;Cuenta destino;Nota');
  expect(csv).toContain(';Gasto;-1250,00;ARS;Supermercado;');
});
