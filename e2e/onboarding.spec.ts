import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('first launch shows onboarding once', async ({ page }, info) => {
  await page.goto('/movimientos');
  await expect(page).toHaveURL(/\/bienvenida$/);
  await expect(page.getByRole('heading', { name: 'Vuelto' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.waitForTimeout(900); // let the entrance finish
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/bienvenida.png` });

  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
});
