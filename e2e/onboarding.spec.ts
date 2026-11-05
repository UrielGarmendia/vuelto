import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('first launch shows onboarding once', async ({ page }, info) => {
  await page.goto('/movimientos');
  await expect(page).toHaveURL(/\/bienvenida$/);
  await expect(page.getByRole('heading', { name: 'Vuelto' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/bienvenida.png` });

  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Tu saldo')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
});

test('falls back to the 2D coin when motion is reduced', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/bienvenida');
  await expect(page.locator('[data-coin]')).toHaveAttribute('data-coin', '2d');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('renders the 3D coin where WebGL is available', async ({ page }, info) => {
  await page.goto('/bienvenida');
  const coin = page.locator('[data-coin]');
  const mode = await coin.getAttribute('data-coin');
  // Headless hardware may legitimately pick 2D (few cores); then there must be no canvas.
  if (mode === '3d') await expect(page.locator('canvas')).toBeVisible();
  else await expect(page.locator('canvas')).toHaveCount(0);
  info.annotations.push({ type: 'coin-mode', description: String(mode) });
});

test('shows the 2D coin if the 3D chunk cannot load', async ({ page }) => {
  await page.route(/CoinScene-.*\.js$/, (route) => route.abort());
  await page.goto('/bienvenida');
  await expect(page.getByRole('heading', { name: 'Vuelto' })).toBeVisible();
  await expect(page.locator('[data-coin] svg')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
});
