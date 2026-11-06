import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
});

const sheet = (page: Page) => page.getByRole('dialog');

async function addExpense(page: Page, digits: string, category: string, note?: string) {
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const pad = sheet(page).getByRole('group', { name: 'Teclado numérico' });
  for (const d of digits) {
    await pad.getByRole('button', { name: d === ',' ? 'Coma decimal' : d, exact: true }).click();
  }
  await sheet(page).getByRole('radio', { name: category }).click();
  if (note) {
    await sheet(page).getByRole('button', { name: 'Nota' }).click();
    await sheet(page).getByLabel('Nota').fill(note);
  }
  await sheet(page)
    .getByRole('button', { name: /^Guardar (gasto|ingreso)$/ })
    .click();
  await expect(sheet(page)).toBeHidden();
}

test('adds an expense from the keypad and lists it under today', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '1250', 'Supermercado', 'Chino de la esquina');
  await expect(page.getByRole('status')).toContainText('Gasto guardado');
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible();
  const row = page.getByRole('link', { name: /Supermercado/ });
  await expect(row).toContainText('Chino de la esquina');
  await expect(row).toContainText(/−\$\s1\.250/);
});

test('save is disabled until there is an amount', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  await expect(
    sheet(page).getByRole('button', { name: /^Guardar (gasto|ingreso)$/ }),
  ).toBeDisabled();
});

test('preselects the last used category', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '500', 'Transporte');
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  await expect(sheet(page).getByRole('radio', { name: 'Transporte' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('edits a transaction from its detail', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '300', 'Salidas');
  await page.getByRole('link', { name: /Salidas/ }).click();
  await expect(page.getByRole('heading', { name: 'Salidas' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar' }).click();
  const pad = sheet(page).getByRole('group', { name: 'Teclado numérico' });
  await pad.getByRole('button', { name: '0', exact: true }).click();
  await sheet(page).getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(/−\$\s3\.000/).first()).toBeVisible();
});

test('deletes from the detail and restores with undo', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '999', 'Regalos');
  await page.getByRole('link', { name: /Regalos/ }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page).toHaveURL(/\/movimientos$/);
  await expect(page.getByRole('link', { name: /Regalos/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('link', { name: /Regalos/ })).toBeVisible();
});

test('swipe left deletes, swipe right opens the editor', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '100', 'Mascotas');
  const row = page.getByRole('link', { name: /Mascotas/ });
  await expect(row).toBeVisible();
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;

  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, y, { steps: 10 });
  await page.mouse.up();
  await expect(sheet(page).getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();

  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 200, y, { steps: 10 });
  await page.mouse.up();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(row).toBeVisible();
});

test('physical keyboard types the amount and Enter saves', async ({ page }) => {
  await page.goto('/movimientos');
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  await sheet(page).getByRole('radio', { name: 'Hogar' }).click();
  await page.keyboard.type('45,5');
  await expect(sheet(page).getByLabel(/Monto/)).toContainText('45,5');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: /Hogar/ })).toContainText(/−\$\s45,50/);
});

test('manifest shortcut opens the new transaction sheet', async ({ page }) => {
  await page.goto('/?nuevo=gasto');
  await expect(sheet(page)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

for (const theme of ['light', 'dark'] as const) {
  test(`screenshots: list, sheet and detail (${theme})`, async ({ page }, info) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true, theme: t }, version: 0 }),
      );
    }, theme);
    await page.goto('/movimientos');
    await addExpense(page, '18450', 'Supermercado', 'Compra semanal');
    await addExpense(page, '3200', 'Comida afuera');
    await addExpense(page, '1100', 'Transporte', 'SUBE');
    await expect(page.getByRole('status')).toBeHidden({ timeout: 7000 });
    const dir = `e2e/__screenshots__/${info.project.name}`;
    await page.screenshot({ path: `${dir}/lista-${theme}.png` });

    await page.getByRole('button', { name: 'Cargar movimiento' }).click();
    await page.keyboard.type('2500');
    await page.waitForTimeout(500); // let the sheet spring settle
    await page.screenshot({ path: `${dir}/sheet-${theme}.png` });
    await page.keyboard.press('Escape');

    await page.getByRole('link', { name: /Supermercado/ }).click();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
    await page.waitForTimeout(400); // let the view transition finish
    await page.screenshot({ path: `${dir}/detalle-${theme}.png` });
  });
}

test('going back from the detail does not duplicate history', async ({ page }) => {
  // On wide screens a row opens the side panel instead; the detail page is the phone flow.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Movimientos' })
    .click();
  await addExpense(page, '700', 'Ropa');
  await page.getByRole('link', { name: /Ropa/ }).click();
  await expect(page).toHaveURL(/\/movimientos\/.+/);
  await page.getByRole('main').getByRole('link', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/\/movimientos$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('detail opened directly goes back to the list without stacking history', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '800', 'Hogar');
  const href = await page.getByRole('link', { name: /Hogar/ }).getAttribute('href');
  await page.goto(href!);
  await page.getByRole('main').getByRole('link', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/\/movimientos$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/movimientos$/); // the earlier list entry, not the detail
});

test('categories stay reachable in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 430 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const cat = page.getByRole('dialog').getByRole('radio', { name: 'Supermercado' });
  await cat.scrollIntoViewIfNeeded();
  await expect(cat).toBeVisible();
  expect((await cat.boundingBox())!.height).toBeGreaterThan(40);
});

test('searches and filters the list', async ({ page }) => {
  await page.goto('/movimientos');
  await addExpense(page, '1250', 'Supermercado', 'Chino de la esquina');
  await addExpense(page, '800', 'Transporte', 'SUBE');
  await addExpense(page, '3000', 'Salidas');
  const rows = page.getByRole('main').getByRole('link');

  await page.getByLabel('Buscar movimientos').fill('chino');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Supermercado');

  await page.getByLabel('Buscar movimientos').fill('');
  await page.getByLabel('Categoría', { exact: true }).selectOption({ label: 'Transporte' });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('SUBE');

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(rows).toHaveCount(3);

  await page.getByLabel('Buscar movimientos').fill('no existe');
  await expect(page.getByText('Nada por acá')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(rows).toHaveCount(3);
});
