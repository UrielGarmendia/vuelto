import { test as base, expect } from '@playwright/test';

/**
 * Every test runs offline from the dollar API with fixed rates (routed on the context so
 * requests that pass through the service worker are caught too), and under the same
 * security headers as production (`vite preview` sends them): any Content-Security-Policy
 * violation fails the test.
 */
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
  page: async ({ page }, provide) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
      );
    });
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        /CSP violation|Content Security Policy|Refused to (load|execute|connect|apply)/i.test(text)
      )
        violations.push(text);
    });
    await provide(page);
    expect(violations, 'Content-Security-Policy violations').toEqual([]);
  },
});

export { expect, type Page } from '@playwright/test';
