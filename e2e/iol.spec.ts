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
  await context.route('**/api/iol/balance', (route) =>
    route.fulfill({
      json: {
        data: {
          cuentas: [
            { moneda: 'peso_Argentino', disponible: 100000 },
            { moneda: 'dolar_Estadounidense', disponible: 0 },
          ],
        },
      },
    }),
  );
  await context.route('**/api/iol/portfolio', (route) =>
    route.fulfill({
      json: {
        data: {
          activos: [
            {
              cantidad: 10,
              valorizado: 400000,
              variacionDiaria: 2.5,
              titulo: { simbolo: 'GGAL', tipo: 'ACCIONES', moneda: 'peso_Argentino' },
            },
            {
              cantidad: 5,
              valorizado: 500000,
              variacionDiaria: -1.25,
              titulo: { simbolo: 'SPY', tipo: 'CEDEARS', moneda: 'peso_Argentino' },
            },
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
