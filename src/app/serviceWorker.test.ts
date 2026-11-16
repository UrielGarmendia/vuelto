import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateNewestWorker } from './serviceWorker';

/** A worker that moves through states like the browser's, and records messages. */
function worker(state: ServiceWorkerState) {
  const w = Object.assign(new EventTarget(), { state, postMessage: vi.fn() });
  const go = (next: ServiceWorkerState) => {
    w.state = next;
    w.dispatchEvent(new Event('statechange'));
  };
  return { w, go };
}

function install(sw: object) {
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('activateNewestWorker', () => {
  it('does nothing when no worker controls the page or there is no update', async () => {
    install(Object.assign(new EventTarget(), { controller: null }));
    expect(await activateNewestWorker()).toBe(false);

    const reg = { update: vi.fn(async () => {}), installing: null, waiting: null };
    install(Object.assign(new EventTarget(), { controller: {}, getRegistration: async () => reg }));
    expect(await activateNewestWorker()).toBe(false);
    expect(reg.update).toHaveBeenCalled();
  });

  it('waits for the install, skips waiting and resolves once the new worker controls', async () => {
    const { w, go } = worker('installing');
    const sw = Object.assign(new EventTarget(), {
      controller: {},
      getRegistration: async () => ({ update: async () => {}, installing: w, waiting: null }),
    });
    install(sw);
    const done = activateNewestWorker();
    await new Promise((r) => setTimeout(r));
    expect(w.postMessage).not.toHaveBeenCalled();
    go('installed');
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    sw.dispatchEvent(new Event('controllerchange'));
    expect(await done).toBe(true);
  });

  it('fails instead of hanging when the new worker is discarded', async () => {
    const { w, go } = worker('installing');
    install(
      Object.assign(new EventTarget(), {
        controller: {},
        getRegistration: async () => ({ update: async () => {}, installing: w, waiting: null }),
      }),
    );
    const done = activateNewestWorker();
    await new Promise((r) => setTimeout(r));
    go('redundant');
    await expect(done).rejects.toThrow();
  });
});
