import { readFileSync } from 'node:fs';
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
    await sheet.getByRole('button', { name: 'Leer', exact: true }).click();

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
    // Without the AI configured nothing of it shows.
    await expect(sheet.getByRole('button', { name: /Mejorar con IA/ })).toHaveCount(0);
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
  await sheet.getByRole('button', { name: 'Leer', exact: true }).click();
  const card = sheet.getByRole('article');
  await expect(card.getByLabel('Categoría').locator('option:checked')).toHaveText('Salidas');
  await card.getByLabel('Categoría').selectOption({ label: 'Comida afuera' });
  await card.getByRole('button', { name: '¿Usar siempre Comida afuera para «birra»?' }).click();
  await expect(page.getByText('Regla creada: «birra» → Comida afuera')).toBeVisible();
  await card.getByRole('button', { name: 'Descartar' }).click();

  await sheet.getByLabel('¿Qué gastaste o cobraste?').fill('birra 8k');
  await sheet.getByRole('button', { name: 'Leer', exact: true }).click();
  sheet = page.getByRole('dialog', { name: 'Copiloto de carga' });
  await expect(
    sheet.getByRole('article').getByLabel('Categoría').locator('option:checked'),
  ).toHaveText('Comida afuera');
});

// On-device OCR replaced by a fake that "reads" a made-up Coto ticket, so no language data
// is downloaded during the tests.
const TICKET = `COTO C.I.C.S.A.
CUIT 30-54808315-6
Fecha 14/11/26 Hora 18:32
LECHE ENTERA 1L        1.250,00
SUBTOTAL               8.630,49
TOTAL $                8.000,00
TARJETA VISA`;
async function fakeOcr(page: Page) {
  await page.route('**/assets/tesseract-*.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export default { createWorker: async () => ({
        recognize: async () => ({ data: { text: ${JSON.stringify(TICKET)} } }),
        terminate: async () => {},
      }) };`,
    }),
  );
}
// A real image, so compression has something to decode.
const PNG = readFileSync('public/pwa-64x64.png');
const photo = { name: 'ticket.png', mimeType: 'image/png', buffer: PNG };

test('a receipt photo becomes a card, read on the device, and can keep its photo', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
  await fakeOcr(page);
  await page.goto('/movimientos');
  const sheet = await open(page);
  await sheet.getByLabel('Leer un ticket').setInputFiles(photo);
  const card = sheet.getByRole('article');
  await expect(card.getByLabel('Monto')).toHaveValue('8000');
  await expect(card.getByLabel('Categoría').locator('option:checked')).toHaveText('Supermercado');
  await expect(card.getByLabel('Cuenta').locator('option:checked')).toHaveText(
    'Tarjeta de crédito',
  );
  await expect(card.getByLabel('Fecha')).toHaveValue(/-11-14$/);
  await card.getByLabel('Guardar la foto con el movimiento').check();
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(sheet).toBeHidden();

  await page
    .getByRole('region', { name: 'Lista de movimientos' })
    .getByRole('link')
    .first()
    .click();
  await expect(page.getByRole('img', { name: 'Foto del ticket' })).toBeVisible();
});

test('the entry sheet fills itself from a receipt photo', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
  await fakeOcr(page);
  await page.goto('/movimientos');
  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Leer un ticket').setInputFiles(photo);
  await expect(sheet.getByLabel(/^Monto: 8\.000 pesos/)).toBeVisible();
  await expect(sheet.getByRole('radio', { name: 'Supermercado' })).toBeChecked();
  await expect(sheet.getByLabel('Nota')).toHaveValue('Coto C.i.c.s.a.');
  await sheet.getByRole('button', { name: 'Guardar gasto' }).click();
  await expect(sheet).toBeHidden();
});

test('with the AI enabled, "Mejorar con IA" reads only what the device left unsure', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
    localStorage.setItem(
      'vuelto-google',
      JSON.stringify({
        state: {
          profile: { sub: 'u1', email: 'ana@example.com', name: 'Ana' },
          token: { value: 'fake', expiresAt: Date.now() + 3_600_000 },
        },
        version: 0,
      }),
    );
  });
  await context.route('https://www.googleapis.com/**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { files: [] } })
      : route.fulfill({ json: { id: 'f1', name: 'x', version: '1' } }),
  );
  await context.route('**/api/ai/status', (route) =>
    route.fulfill({ json: { enabled: true, remaining: 5 } }),
  );
  const sent: string[] = [];
  await context.route('**/api/ai/copilot', (route) => {
    const body = route.request().postDataJSON() as {
      text: string;
      catalog: {
        categories: { id: string; name: string }[];
        accounts: { id: string; name: string }[];
      };
    };
    sent.push(body.text);
    const id = (list: { id: string; name: string }[], name: string) =>
      list.find((x) => x.name === name)!.id;
    return route.fulfill({
      json: {
        movements: [
          {
            type: 'expense',
            amount: 7000,
            currency: 'ARS',
            categoryId: id(body.catalog.categories, 'Ropa'),
            accountId: id(body.catalog.accounts, 'Banco'),
            toAccountId: null,
            date: new Date().toISOString().slice(0, 10),
            installments: null,
            note: 'Medias',
            confidence: 0.9,
          },
        ],
        quota: 'sealed',
        remaining: 4,
      },
    });
  });

  await page.goto('/');
  const sheet = await open(page);
  await sheet.getByLabel('¿Qué gastaste o cobraste?').fill('coto 10k y unas medias 7 lucas');
  await sheet.getByRole('button', { name: 'Leer', exact: true }).click();
  const cards = sheet.getByRole('article');
  await expect(cards).toHaveCount(2);
  // The supermarket was read on the device; only the socks need help.
  await sheet.getByRole('button', { name: /Mejorar con IA \(1\)/ }).click();
  await expect(cards.nth(1).getByLabel('Categoría').locator('option:checked')).toHaveText('Ropa');
  await expect(cards.nth(1).getByLabel('Nota')).toHaveValue('Medias');
  expect(sent).toEqual(['unas medias 7 lucas']);
  await expect(sheet.getByRole('button', { name: /Mejorar con IA/ })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Guardar todo (2)' }).click();
  await expect(page.getByText('2 movimientos guardados')).toBeVisible();
});

test('with a single account (Naranja X) there is no account to choose anywhere', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
  await page.goto('/movimientos');
  await expect(page.getByRole('button', { name: 'Cargar movimiento' })).toBeVisible();
  // Only "Naranja X" stays: the other default accounts are archived.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('vuelto');
        open.onsuccess = () => {
          const tx = open.result.transaction('accounts', 'readwrite');
          const store = tx.objectStore('accounts');
          const all = store.getAll();
          all.onsuccess = () => {
            for (const a of all.result as { name: string; kind: string }[]) {
              if (a.name === 'Efectivo') store.put({ ...a, name: 'Naranja X', kind: 'wallet' });
              else store.put({ ...a, archived: 1 });
            }
          };
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();

  await page.getByRole('button', { name: 'Cargar movimiento' }).click();
  const entry = page.getByRole('dialog');
  await expect(entry.getByRole('radio', { name: 'Supermercado' })).toBeVisible();
  await expect(entry.getByLabel('Cuenta')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(entry).toBeHidden();

  const sheet = await open(page);
  await sheet
    .getByLabel('¿Qué gastaste o cobraste?')
    .fill('heladera en 12 cuotas, 1 palo y medio con la visa\nvendí un escape por 350000');
  await sheet.getByRole('button', { name: 'Leer', exact: true }).click();
  const cards = sheet.getByRole('article');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByLabel('Cuenta')).toHaveCount(0);
  await expect(cards.nth(0).getByLabel('Nota')).toHaveValue('Heladera');
  // The income lands in "Otros", flagged for review.
  await expect(cards.nth(1).getByLabel('Categoría').locator('option:checked')).toHaveText('Otros');
  await expect(cards.nth(1)).toContainText('Revisá');
  await sheet.getByRole('button', { name: 'Guardar todo (2)' }).click();
  await expect(page.getByText('2 movimientos guardados')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lista de movimientos' })).toContainText(
    'Heladera · Naranja X',
  );
});

test('a receipt is read for real on the device, with the reader served by the app', async ({
  page,
}) => {
  test.setTimeout(120_000); // the engine and Spanish data load once (~6 MB)
  await page.addInitScript(() => {
    localStorage.setItem(
      'vuelto-prefs',
      JSON.stringify({ state: { installDismissed: true }, version: 0 }),
    );
  });
  const outside: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) outside.push(r.url());
  });
  await page.goto('/movimientos');
  // A clean, made-up ticket drawn on a canvas.
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 520;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000';
    g.font = 'bold 46px monospace';
    ['KIOSCO EL SOL', 'Fecha 14/11/26', 'ALFAJOR    1.200,00', 'TOTAL $    1.200,00'].forEach(
      (line, i) => g.fillText(line, 40, 90 + i * 110),
    );
    return c.toDataURL('image/png').split(',')[1]!;
  });
  const sheet = await open(page);
  await sheet
    .getByLabel('Leer un ticket')
    .setInputFiles({
      name: 'ticket.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
  const card = sheet.getByRole('article');
  await expect(card.getByLabel('Monto')).toHaveValue('1200', { timeout: 90_000 });
  await expect(card.getByLabel('Nota')).toHaveValue(/Kiosco El Sol/i);
  expect(outside.filter((u) => !u.includes('dolarapi.com'))).toEqual([]);
});
