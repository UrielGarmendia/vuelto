import { test as base } from '@playwright/test';

/** Every test runs offline from the dollar API with fixed rates. Routed on the context so
 * requests that pass through the service worker are caught too. */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.route('https://dolarapi.com/**', (route) =>
      route.fulfill({
        json: [
          { casa: 'oficial', compra: 1000, venta: 1050 },
          { casa: 'blue', compra: 1200, venta: 1230 },
          { casa: 'bolsa', compra: 1190, venta: 1210 },
        ],
      }),
    );
    await provide(context);
  },
});

export { expect, type Page } from '@playwright/test';
