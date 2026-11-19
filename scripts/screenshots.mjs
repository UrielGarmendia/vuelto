// Store screenshots for the manifest and the Open Graph image, from a clean browser with
// made-up data only. Needs `npm run build && npm run preview` running on port 4173.
//   node scripts/screenshots.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';

/** A believable, entirely invented month: nobody's real money. */
const DEMO = [
  ['income', 'Sueldo', 145_000_000, 1, 'Sueldo de noviembre'],
  ['expense', 'Alquiler', 42_000_000, 1, 'Alquiler'],
  ['expense', 'Supermercado', 3_850_000, 2, 'Coto'],
  ['expense', 'Transporte', 120_000, 3, 'Sube'],
  ['expense', 'Comida afuera', 1_890_000, 4, 'Pizzería con amigos'],
  ['expense', 'Servicios', 2_430_000, 5, 'Luz'],
  ['expense', 'Supermercado', 2_210_000, 6, 'Verdulería'],
  ['expense', 'Nafta', 3_500_000, 7, 'YPF'],
  ['expense', 'Salidas', 1_200_000, 8, 'Cine'],
  ['expense', 'Suscripciones', 990_000, 9, 'Música'],
  ['expense', 'Supermercado', 4_120_000, 10, 'Changomás'],
  ['expense', 'Transporte', 250_000, 11, 'Colectivo'],
  ['expense', 'Salud', 860_000, 12, 'Farmacia'],
  ['expense', 'Comida afuera', 1_450_000, 13, 'Café'],
  ['expense', 'Ropa', 5_600_000, 14, 'Zapatillas'],
  ['expense', 'Supermercado', 1_780_000, 15, 'Almacén'],
];

async function seed(page) {
  await page.goto(`${BASE}/movimientos`);
  await page.getByRole('button', { name: 'Cargar movimiento' }).waitFor();
  await page.evaluate((demo) => {
    return new Promise((resolve) => {
      const open = indexedDB.open('vuelto');
      open.onsuccess = () => {
        const tx = open.result.transaction(['transactions', 'categories', 'accounts'], 'readwrite');
        const cats = tx.objectStore('categories').getAll();
        const accs = tx.objectStore('accounts').getAll();
        accs.onsuccess = () => {
          const byName = new Map(cats.result.map((c) => [c.name, c.id]));
          const account = accs.result.find((a) => a.name === 'Banco') ?? accs.result[0];
          const now = new Date();
          const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          demo.forEach(([type, cat, cents, day, note], i) => {
            const d = Math.min(day, now.getDate());
            tx.objectStore('transactions').put({
              id: `demo-${i}`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              deleted: 0,
              synced: 0,
              type,
              amountCents: cents,
              currency: 'ARS',
              date: `${month}-${String(d).padStart(2, '0')}`,
              categoryId: byName.get(cat) ?? byName.get('Supermercado'),
              accountId: account.id,
              note,
              tags: [],
            });
          });
        };
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
      };
    });
  }, DEMO);
}

async function shoot(viewport, path, url = '/') {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 600 ? 3 : 1,
    colorScheme: 'dark',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE,
          localStorage: [
            { name: 'vuelto-onboarded', value: '1' },
            {
              name: 'vuelto-prefs',
              value: JSON.stringify({
                state: { installDismissed: true, theme: 'dark' },
                version: 0,
              }),
            },
          ],
        },
      ],
    },
  });
  // Never reach the real dollar API: fixed, invented rates.
  await context.route('https://dolarapi.com/**', (r) =>
    r.fulfill({
      json: [
        { casa: 'oficial', compra: 1000, venta: 1050 },
        { casa: 'blue', compra: 1200, venta: 1230 },
        { casa: 'bolsa', compra: 1190, venta: 1210 },
      ],
    }),
  );
  const page = await context.newPage();
  await seed(page);
  await page.goto(`${BASE}${url}`);
  await page.waitForTimeout(1500); // odometer and dial settle
  await page.screenshot({ path });
  await browser.close();
  console.log('wrote', path);
}

await shoot({ width: 390, height: 844 }, 'public/screenshots/phone.png');
await shoot({ width: 1440, height: 900 }, 'public/screenshots/desktop.png', '/movimientos');
await shoot({ width: 1200, height: 630 }, 'public/og.png');
