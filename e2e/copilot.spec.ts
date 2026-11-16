import { expect, test, type Page } from './fixtures';

const open = async (page: Page) => {
  await page
    .getByRole('button', { name: /Copiloto/ })
    .filter({ visible: true })
    .click();
  return page.getByRole('dialog', { name: 'Copiloto de carga' });
};

for (const theme of ['light', 'dark'] as const) {
  test(`the copilot reads several movements locally and saves them after review (${theme})`, async ({
    page,
    context,
  }, info) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true, theme: t }, version: 0 }),
      );
    }, theme);
    await page.goto('/movimientos');
    const sheet = await open(page);
    await expect(sheet.getByLabel('¿Qué gastaste o cobraste?')).toBeVisible();
    // Reading happens on the device: it works without a connection (in the app the service
    // worker keeps the code; here it is off, so the sheet loads first).
    await context.setOffline(true);
    await sheet
      .getByLabel('¿Qué gastaste o cobraste?')
      .fill(
        'nafta 35 lucas y sube 2 lucas\nheladera en 12 cuotas, 1 palo y medio con la visa\n100 verdes que me debía juan',
      );
    await sheet.getByRole('button', { name: 'Leer' }).click();

    const cards = sheet
      .getByRole('region', { name: 'Movimientos para revisar' })
      .getByRole('article');
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0).getByLabel('Monto')).toHaveValue('35000');
    await expect(cards.nth(0).getByLabel('Categoría')).toHaveValue(/.+/);
    await expect(cards.nth(1).getByLabel('Categoría').locator('option:checked')).toHaveText(
      'Transporte',
    );
    await expect(cards.nth(2).getByLabel('Cuotas')).toHaveValue('12');
    await expect(cards.nth(2).getByLabel('Monto')).toHaveValue('1500000');
    // No dollar account: the card says so and saving waits.
    const usd = cards.nth(3);
    await expect(usd).toContainText('Revisá');
    await expect(usd).toContainText('una cuenta en dólares');
    await expect(sheet.getByRole('button', { name: 'Guardar todo (4)' })).toBeDisabled();
    await page.screenshot({
      path: `e2e/__screenshots__/${info.project.name}/copiloto-${theme}.png`,
      fullPage: false,
    });

    await usd.getByRole('button', { name: 'Descartar' }).click();
    await sheet.getByRole('button', { name: 'Guardar todo (3)' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText('3 movimientos guardados')).toBeVisible();
    const list = page.getByRole('region', { name: 'Lista de movimientos' });
    await expect(list).toContainText('Heladera');
    await expect(list).toContainText('cuota 12/12');
  });
}

test('correcting a card offers a rule, so the next reading gets it right', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
  await page.goto('/');
  let sheet = await open(page);
  await sheet.getByLabel('¿Qué gastaste o cobraste?').fill('birra 5k');
  await sheet.getByRole('button', { name: 'Leer' }).click();
  const card = sheet.getByRole('article');
  await expect(card.getByLabel('Categoría').locator('option:checked')).toHaveText('Salidas');
  await card.getByLabel('Categoría').selectOption({ label: 'Comida afuera' });
  await card.getByRole('button', { name: '¿Usar siempre Comida afuera para «birra»?' }).click();
  await expect(page.getByText('Regla creada: «birra» → Comida afuera')).toBeVisible();
  await card.getByRole('button', { name: 'Descartar' }).click();

  await sheet.getByLabel('¿Qué gastaste o cobraste?').fill('birra 8k');
  await sheet.getByRole('button', { name: 'Leer' }).click();
  sheet = page.getByRole('dialog', { name: 'Copiloto de carga' });
  await expect(
    sheet.getByRole('article').getByLabel('Categoría').locator('option:checked'),
  ).toHaveText('Comida afuera');
});
