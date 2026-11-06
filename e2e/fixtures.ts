import { test as base } from '@playwright/test';

/** Every test runs offline from the dollar API with fixed rates. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route('https://dolarapi.com/**', (route) =>
      route.fulfill({
        json: [
          { casa: 'oficial', compra: 1000, venta: 1050 },
          { casa: 'blue', compra: 1200, venta: 1230 },
          { casa: 'bolsa', compra: 1190, venta: 1210 },
        ],
      }),
    );
    await provide(page);
  },
});

export { expect, type Page } from '@playwright/test';
