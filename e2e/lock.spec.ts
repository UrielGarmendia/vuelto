import { expect, test, type BrowserContext, type Page } from './fixtures';

/** Signed in with Google as ana@example.com (u1); Drive answered locally. */
async function signedIn(page: Page, context: BrowserContext) {
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
  await context.route('https://www.googleapis.com/drive/**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { files: [] } })
      : route.fulfill({ json: { id: 'f1', name: 'x', version: '1' } }),
  );
  await context.route('https://www.googleapis.com/upload/**', (route) =>
    route.fulfill({ json: { id: 'f1', name: 'x', version: '1' } }),
  );
}

/** Google Identity Services answering at once, and userinfo saying who signed in. */
async function fakeGoogle(context: BrowserContext, sub: string) {
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.google = { accounts: { oauth2: {
        initTokenClient: (c) => ({ requestAccessToken: () => c.callback({ access_token: 'g2', expires_in: 3600 }) }),
        revoke: () => {},
      } } };`,
    }),
  );
  await context.route('https://www.googleapis.com/oauth2/v3/userinfo', (route) =>
    route.fulfill({ json: { sub, email: 'ana@example.com', name: 'Ana' } }),
  );
}

const lockSwitch = (page: Page) =>
  page.getByRole('switch', { name: /Bloquear con huella, cara o PIN/ });

test('the lock is offered only where the device has its own unlock', async ({ page, context }) => {
  await signedIn(page, context);
  await page.goto('/ajustes');
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();
  const supported = await page.evaluate(
    async () =>
      typeof PublicKeyCredential !== 'undefined' &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()),
  );
  await expect(lockSwitch(page)).toHaveCount(supported ? 1 : 0);
});

test('locks on opening, unlocks with the device and falls back to the same Google account', async ({
  page,
  context,
  browserName,
}, info) => {
  // A virtual fingerprint reader exists only through Chromium's DevTools protocol.
  if (browserName !== 'chromium') return;
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await signedIn(page, context);

  await page.goto('/ajustes');
  await page.locator('label', { has: lockSwitch(page) }).click();
  await expect(page.getByText('Bloqueo activado')).toBeVisible();
  await expect(lockSwitch(page)).toBeChecked();

  // Opening again: nothing with data until the device says so.
  await page.reload();
  const lockScreen = page.getByRole('main', { name: 'Vuelto bloqueado' });
  await expect(lockScreen).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toHaveCount(0);
  await page.screenshot({ path: `e2e/__screenshots__/${info.project.name}/bloqueo.png` });
  await lockScreen.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();

  // The fingerprint is gone (new phone, erased): Google lets the same person back in.
  await cdp.send('WebAuthn.clearCredentials', { authenticatorId });
  await page.reload();
  await lockScreen.getByRole('button', { name: 'Desbloquear' }).click();
  const google = lockScreen.getByRole('button', { name: 'Entrar con Google (ana@example.com)' });
  await expect(google).toBeVisible();

  // Another account is not enough.
  await fakeGoogle(context, 'someone-else');
  await google.click();
  await expect(lockScreen).toContainText('Entrá con ana@example.com');
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toHaveCount(0);

  await context.unroute('https://www.googleapis.com/oauth2/v3/userinfo');
  await fakeGoogle(context, 'u1');
  await google.click();
  await lockScreen.getByRole('button', { name: 'Registrar el bloqueo' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();

  // Registered again: the new fingerprint opens it next time.
  await page.reload();
  await lockScreen.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();
});

test('after a while in the background it asks again, keeping what was on screen', async ({
  page,
  context,
  browserName,
}) => {
  if (browserName !== 'chromium') return;
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await signedIn(page, context);
  await page.goto('/ajustes');
  await page.locator('label', { has: lockSwitch(page) }).click();
  await expect(lockSwitch(page)).toBeChecked();

  // A half-written goal, then six minutes away (the lock asks again after five).
  // In-app navigation: a reload would (rightly) open on the lock screen.
  await page.getByRole('link', { name: /Metas de ahorro/ }).click();
  await page.getByRole('button', { name: 'Nueva meta' }).click();
  await page.getByLabel('Nombre').fill('Moto');
  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  // Six minutes pass while the app is away.
  await page.evaluate(() => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + 6 * 60_000;
  });
  await setVisibility('visible');

  const lockScreen = page.getByRole('main', { name: 'Vuelto bloqueado' });
  await expect(lockScreen).toBeVisible();
  await expect(page.getByLabel('Nombre')).toBeHidden();
  await lockScreen.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByLabel('Nombre')).toHaveValue('Moto');
});
