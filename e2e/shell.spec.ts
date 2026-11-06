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
  // Tap right away: a tab tap during boot used to crash WebKit with view transitions.
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
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
});

test('install banner shows the right instructions per platform', async ({
  page,
  browserName,
}, info) => {
  await page.goto('/');
  const banner = page.getByRole('complementary', { name: 'Instalá Vuelto' });
  // The WebKit projects emulate iOS/iPadOS, which only offer Share → Add to Home Screen.
  if (browserName === 'webkit') {
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

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Tu saldo')).toBeVisible();
  await page.goto('/ajustes');
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();
});

test('returns to Inicio from Ajustes', async ({ page }) => {
  await page.goto('/ajustes');
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Inicio' })
    .click();
  await expect(page.getByText('Tu saldo')).toBeVisible();
});

test('a new page starts at the top, going back restores the scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 }); // make Ajustes scroll everywhere
  await setPrefs(page, { installDismissed: true });
  await page.goto('/ajustes');
  await expect(page.getByRole('button', { name: 'Borrar todo' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Categorías/ })).toContainText('21');
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const saved = await page.evaluate(() => window.scrollY);
  // el.click() skips Playwright's scroll-into-view, which would change the position we save.
  await page.getByRole('link', { name: /Categorías/ }).evaluate((el: HTMLElement) => el.click());
  await expect(page.getByRole('heading', { name: 'Categorías' })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/ajustes$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(saved);
});
