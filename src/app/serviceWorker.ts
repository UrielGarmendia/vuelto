/**
 * Puts the newest service worker in charge before leaving for a flow that comes back to us
 * (OAuth). An older worker may answer the return URL with the app shell instead of letting it
 * reach the server. Resolves true when a newer worker took over; the page should reload.
 */
export async function activateNewestWorker(timeoutMs = 15_000): Promise<boolean> {
  const sw = navigator.serviceWorker;
  // Without a controller nothing intercepts the return trip yet.
  if (!sw?.controller) return false;
  const reg = await sw.getRegistration();
  if (!reg) return false;
  // Offline or a failed check: keep the current worker rather than blocking the user.
  await reg.update().catch(() => undefined);
  const next = reg.installing ?? reg.waiting;
  if (!next) return false;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('El service worker nuevo no se activó')),
      timeoutMs,
    );
    sw.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    const step = () => {
      if (next.state === 'installed') next.postMessage({ type: 'SKIP_WAITING' });
      if (next.state === 'redundant') {
        clearTimeout(timer);
        reject(new Error('El service worker nuevo se descartó'));
      }
    };
    next.addEventListener('statechange', step);
    step();
  });
  return true;
}
