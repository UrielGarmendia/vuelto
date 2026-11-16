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
  const balance = page.getByRole('region', { name: 'Patrimonio' });
  await expect(balance).toContainText('Invertido$ 1.000.000');
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
