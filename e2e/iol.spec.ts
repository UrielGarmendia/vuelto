import { expect, test } from './fixtures';

// Signed in with Google (fake token), Drive and our IOL functions answered locally.
test.beforeEach(async ({ page, context }) => {
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
  await context.route('**/api/iol/start', (route) =>
    route.fulfill({ json: { url: '/ajustes/cuentas#iol=sealed-blob' } }),
  );
  // Shaped like IOL's MCP answers; the amounts are made up.
  const terms = (t0: number) => ({ t0, t1: t0, t2: t0, t3: t0 });
  const cash = (amount: number) => ({
    totals: terms(amount),
    available: terms(amount),
    committed: terms(0),
    available_for_withdrawal: amount,
  });
  await context.route('**/api/iol/balance', (route) =>
    route.fulfill({
      json: { data: { arg_ars: cash(100000), arg_usd: cash(0), eeuu_usd: cash(0) } },
    }),
  );
  const position = (
    symbol: string,
    type: string,
    quantity: number,
    price: number,
    pct: number,
  ) => ({
    quantity,
    unit_price: price,
    lot_price: price,
    committed: 0,
    daily_change_pct: pct,
    asset: {
      symbol,
      description: symbol,
      market: 'BCBA',
      type,
      currency: 'ARS',
      units_per_lot: 1,
      country: 'ARG',
      term: 'T1',
    },
  });
  await context.route('**/api/iol/portfolio**', (route) =>
    route.fulfill({
      json: {
        data:
          new URL(route.request().url()).searchParams.get('country') === 'estados_Unidos'
            ? { country: 'USA', positions: [] }
            : {
                country: 'ARG',
                positions: [
                  position('GGAL', 'Acciones', 10, 40000, 2.5),
                  position('SPY', 'CEDEARS', 5, 100000, -1.25),
                ],
              },
      },
    }),
  );
});

test('connects IOL, shows the portfolio and the net worth, and disconnects', async ({
  page,
}, info) => {
  await page.goto('/ajustes/cuentas');
  await page.getByRole('button', { name: 'Conectar IOL' }).click();

  const card = page.getByRole('region', { name: /IOL — Inversiones/ });
  await expect(card).toContainText('Vinculada');
  await expect(card).toContainText('$ 1.000.000');
  await expect(card).toContainText('Acciones');
  await expect(card).toContainText('CEDEARs');
  await expect(card.getByText('GGAL')).toBeVisible();
  await expect(card).toContainText('Actualizado');
  await expect(page.getByRole('status')).toBeHidden({ timeout: 7000 });
  await page.screenshot({
    path: `e2e/__screenshots__/${info.project.name}/iol-cuentas.png`,
    fullPage: true,
  });

  await page.goto('/');
  const balance = page.getByRole('region', { name: 'Patrimonio', exact: true });
  await expect(balance.getByRole('img', { name: '$ 1.000.000' })).toBeVisible();
  // IOL's cash counts as available; invested is only the positions.
  await expect(balance).toContainText('Disponible$ 100.000incluye $ 100.000 en IOL');
  await expect(balance).toContainText('Invertido$ 900.000');
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/iol-inicio.png` });

  await page.goto('/ajustes/cuentas');
  await card.getByRole('button', { name: 'Desconectar' }).click();
  await card.getByRole('button', { name: 'Desconectar' }).click();
  await expect(page.getByRole('button', { name: 'Conectar IOL' })).toBeVisible();
});

test('without Google, IOL asks to sign in first', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('vuelto-google'));
  await page.goto('/ajustes/cuentas');
  await expect(page.getByText(/necesita el inicio de sesión con Google/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conectar IOL' })).toHaveCount(0);
});

test('an expired or reused authorization shows a clear error with Reintentar', async ({
  page,
}, info) => {
  await page.goto('/ajustes/cuentas#iol-error=failed');
  const alert = page.getByRole('alert').filter({ hasText: 'IOL no aceptó la autorización' });
  await expect(alert).toBeVisible();
  await expect(page).toHaveURL(/\/ajustes\/cuentas$/);
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/iol-error.png` });

  await alert.getByRole('button', { name: 'Reintentar' }).click();
  const card = page.getByRole('region', { name: /IOL — Inversiones/ });
  await expect(card).toContainText('Vinculada');
  await expect(alert).toBeHidden();
});

// A fuller portfolio: two markets, a fund and a stock that fell.
const holding = (
  symbol: string,
  type: string,
  quantity: number,
  price: number,
  pct: number,
  extra: { market?: string; currency?: string } = {},
) => ({
  quantity,
  unit_price: price,
  lot_price: price,
  committed: 0,
  daily_change_pct: pct,
  asset: {
    symbol,
    description: `${symbol} descripción`,
    market: extra.market ?? 'BCBA',
    type,
    currency: extra.currency ?? 'ARS',
    units_per_lot: 1,
    country: extra.market && extra.market !== 'BCBA' ? 'USA' : 'ARG',
    term: 'T1',
  },
});

for (const theme of ['light', 'dark'] as const) {
  test(`the portfolio lists every position and each asset has its chart (${theme})`, async ({
    page,
  }, info) => {
    await page.addInitScript((t) => {
      localStorage.setItem(
        'vuelto-prefs',
        JSON.stringify({ state: { installDismissed: true, theme: t }, version: 0 }),
      );
    }, theme);
    await page.route('**/api/iol/portfolio**', (route) =>
      route.fulfill({
        json: {
          data:
            new URL(route.request().url()).searchParams.get('country') === 'estados_Unidos'
              ? {
                  country: 'USA',
                  positions: [
                    holding('AAPL', 'Acciones', 2, 200, 1, { market: 'NASDAQ', currency: 'USD' }),
                  ],
                }
              : {
                  country: 'ARG',
                  positions: [
                    holding('GGAL', 'Acciones', 10, 4000, 2.5),
                    holding('YPFD', 'Acciones', 5, 40000, -1),
                    holding('SPY', 'CEDEARS', 5, 30000, 0.5),
                    holding('FIMA', 'Fondo Común de Inversión', 1000, 50, 0.1),
                  ],
                },
        },
      }),
    );
    const asked: string[] = [];
    await page.route('**/api/iol/history**', (route) => {
      asked.push(new URL(route.request().url()).search);
      return route.fulfill({
        json: {
          data: [0, 1, 2, 3, 4].map((i) => ({
            time: 1_760_000_000 + i * 86_400,
            open: 4000,
            high: 4100,
            low: 3900,
            close: 3800 + i * 50,
            volume: 100,
          })),
        },
      });
    });

    await page.goto('/ajustes/cuentas');
    await page.getByRole('button', { name: 'Conectar IOL' }).click();
    await page.getByRole('link', { name: 'Ver todas las posiciones' }).click();
    await expect(page.getByRole('heading', { name: 'Inversiones', level: 1 })).toBeVisible();

    const total = page.getByRole('region', { name: 'Total en IOL' });
    // 100.000 cash + 40.000 + 200.000 + 150.000 + 50.000 + 400 USD × 1.210
    await expect(total).toContainText('$ 1.024.000');
    await expect(total).toContainText('Invertido$ 924.000');
    await expect(page.getByRole('region', { name: 'Por tipo' })).toContainText('FCI');
    await expect(page.getByRole('region', { name: 'Por mercado' })).toContainText('EE.UU.');

    const stocks = page.getByRole('heading', { name: /^Acciones/ }).locator('xpath=..');
    const rows = stocks.getByRole('link');
    await expect(rows.first()).toContainText('AAPL'); // US$ 400 ≈ $ 484.000, the largest
    await page.getByRole('radio', { name: 'Variación' }).click();
    await expect(rows.first()).toContainText('GGAL');
    await expect(rows.last()).toContainText('YPFD');
    await expect(rows.last()).toContainText('−1,00 %');
    await page.screenshot({
      path: `e2e/__screenshots__/${info.project.name}/inversiones-${theme}.png`,
      fullPage: true,
    });

    await rows.filter({ hasText: 'GGAL' }).click();
    await expect(page.getByRole('heading', { name: 'GGAL', level: 1 })).toBeVisible();
    await expect(page.getByRole('img', { name: /Precio de GGAL en un mes/ })).toBeVisible();
    await page.getByRole('radio', { name: 'tres meses' }).click();
    await expect(page.getByRole('img', { name: /Precio de GGAL en tres meses/ })).toBeVisible();
    await expect(page.getByText('Peso en el portafolio')).toBeVisible();
    // GGAL at $ 4.000, +2,5 % today: the price moved $ 97,56; ten of them, $ 975,61.
    const price = page.getByRole('region', { name: 'Precio' });
    await expect(price).toContainText('Precio hoy+$ 97,56 · +2,50 %');
    await expect(price).toContainText('Tu posición hoy+$ 975,61');
    await page.screenshot({
      path: `e2e/__screenshots__/${info.project.name}/activo-${theme}.png`,
      fullPage: true,
    });
    expect(asked).toEqual([
      '?symbol=GGAL&market=BCBA&range=1M',
      '?symbol=GGAL&market=BCBA&range=3M',
    ]);

    await page.goBack();
    await page.getByRole('link', { name: /FIMA/ }).click();
    await expect(page.getByText('Sin gráfico disponible para este activo')).toBeVisible();
    expect(asked).toHaveLength(2);
  });
}
