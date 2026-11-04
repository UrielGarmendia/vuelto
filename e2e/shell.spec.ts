import { expect, test, type Page } from '@playwright/test';

const routes = [
  { path: '/', name: 'inicio', heading: 'Tu saldo' },
  { path: '/movimientos', name: 'movimientos', heading: 'Movimientos' },
  { path: '/estadisticas', name: 'estadisticas', heading: 'Estadísticas' },
  { path: '/ajustes', name: 'ajustes', heading: 'Ajustes' },
];

function setPrefs(page: Page, prefs: Record<string, unknown>) {
  return page.addInitScript((state) => {
    localStorage.setItem('vuelto-prefs', JSON.stringify({ state, version: 0 }));
  }, prefs);
}

for (const theme of ['light', 'dark'] as const) {
  for (const route of routes) {
    test(`${route.name} (${theme}) renders without overflow`, async ({ page }, info) => {
      await setPrefs(page, { theme, installDismissed: true });
      await page.goto(route.path);
      await expect(page.getByText(route.heading, { exact: true }).first()).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: `e2e/__screenshots__/${info.project.name}/${route.name}-${theme}.png`,
      });
    });
  }
}

test('tab bar navigates between sections', async ({ page }) => {
  await setPrefs(page, { installDismissed: true });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await nav.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
  await expect(nav.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Movimientos' }).click();
  await expect(page.getByRole('heading', { name: 'Movimientos', exact: true })).toBeVisible();
});

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/ajustes');
  await page.getByText('Oscuro', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141210');
});

test('install banner shows the right instructions per platform', async ({ page }, info) => {
  await page.goto('/');
  const banner = page.getByRole('complementary', { name: 'Instalá Vuelto' });
  if (info.project.name === 'iphone-15') {
    await expect(banner).toContainText('Agregar a inicio');
    await expect(banner).toHaveCSS('opacity', '1');
    await expect(banner.getByRole('button', { name: 'Instalar' })).toHaveCount(0);
    await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/install-banner.png` });
    await banner.getByRole('button', { name: 'Cerrar' }).click();
    await expect(banner).toBeHidden();
  } else {
    // Headless Chromium never fires beforeinstallprompt, so the banner must stay hidden.
    await expect(page.getByText('Tu saldo')).toBeVisible();
    await expect(banner).toHaveCount(0);
  }
});

test('works offline after the first visit', async ({ page, context }, info) => {
  test.skip(info.project.name === 'iphone-15', 'Playwright WebKit does not run service workers');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Tu saldo')).toBeVisible();
  await page.goto('/ajustes');
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();
});

test('returning to Inicio from Ajustes with a view transition', async ({ page }, info) => {
  // Playwright's WebKit build for Windows crashes intermittently (~20%) on this exact
  // transition; not reproduced in Chromium. Verify on a real iPhone before trusting the skip.
  test.skip(info.project.name === 'iphone-15', 'WebKit-on-Windows crash, see CLAUDE.local.md');
  await page.goto('/ajustes');
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Inicio' })
    .click();
  await expect(page.getByText('Tu saldo')).toBeVisible();
});
