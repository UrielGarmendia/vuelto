import { expect, test, type Page } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
});

async function newExpense(page: Page, digits: string, note: string) {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const sheet = page.getByRole('dialog');
  const pad = sheet.getByRole('group', { name: 'Teclado numérico' });
  for (const d of digits) await pad.getByRole('button', { name: d, exact: true }).click();
  await sheet.getByRole('button', { name: 'Nota' }).click();
  await sheet.getByLabel('Nota').fill(note);
  return sheet;
}

for (const theme of ['light', 'dark'] as const) {
  test(`rules pick the category, can be tested and are learned from corrections (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true, theme: t }, version: 0 }),
      );
    }, theme);
    await page.goto('/ajustes');
    await page.getByRole('link', { name: /Reglas de categorías/ }).click();
    await page.getByRole('button', { name: 'Nueva regla' }).click();
    await page.getByLabel('Si la nota contiene').fill('uber');
    await page.getByLabel('Usar la categoría').selectOption({ label: 'Transporte' });
    await page.getByLabel('Y la etiqueta (opcional)').fill('#viajes');
    await page.getByRole('button', { name: 'Guardar' }).click();
    const rules = page.getByRole('list', { name: 'Reglas' });
    await expect(rules).toContainText('«uber»');

    await page.getByLabel('Probá con un texto').fill('Uber al centro');
    await expect(page.getByText('Aplica «uber» → Transporte')).toBeVisible();
    await page.getByLabel('Probá con un texto').fill('colectivo');
    await expect(page.getByText('Ninguna regla aplica.')).toBeVisible();
    await page.screenshot({
      path: `e2e/__screenshots__/${info.project.name}/reglas-${theme}.png`,
      fullPage: true,
    });

    // The rule picks Transporte and adds its tag.
    await page.goto('/movimientos');
    let sheet = await newExpense(page, '3500', 'Uber al centro');
    await expect(sheet.getByRole('radio', { name: 'Transporte' })).toBeChecked();
    await expect(sheet).toContainText('Categoría por la regla «uber»');
    await sheet.getByRole('button', { name: 'Guardar gasto' }).click();
    await expect(sheet).toBeHidden();
    const list = page.getByRole('region', { name: 'Lista de movimientos' });
    await list.getByRole('link').first().click();
    await expect(page.getByRole('button', { name: '#viajes' })).toBeVisible();

    // A correction teaches a new rule.
    await page.goto('/movimientos');
    sheet = await newExpense(page, '12000', 'birra con los pibes');
    await sheet.getByRole('radio', { name: 'Supermercado' }).click();
    await sheet.getByRole('button', { name: 'Guardar gasto' }).click();
    await expect(sheet).toBeHidden();
    await list.getByRole('link').first().click();
    await page.getByRole('button', { name: 'Editar' }).click();
    sheet = page.getByRole('dialog');
    await sheet.getByRole('radio', { name: 'Salidas' }).click();
    await sheet.getByRole('button', { name: /Guardar/ }).click();
    const offer = page.getByText('¿Usar siempre Salidas para «birra»?');
    await expect(offer).toBeVisible();
    await page.getByRole('button', { name: 'Sí' }).click();
    await expect(page.getByText('Regla creada')).toBeVisible();

    await page.goto('/ajustes/reglas');
    await expect(rules).toContainText('«birra»');
  });
}
