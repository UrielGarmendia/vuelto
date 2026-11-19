import { Fingerprint } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Wordmark } from '../../ui/Wordmark';
import {
  enableLock,
  readLock,
  unlockWithDevice,
  unlockWithGoogle,
  WrongAccountError,
  type LockSettings,
} from './lock';

/**
 * Keeps the app hidden while locked. On opening nothing with data is mounted until the
 * person unlocks; after a while in the background the app stays mounted (drafts are kept)
 * but hidden under the lock screen.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const [lock, setLock] = useState<LockSettings | undefined>(readLock);
  const [locked, setLocked] = useState(() => !!readLock());
  const [mounted, setMounted] = useState(() => !readLock());

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      const current = readLock();
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (current && hiddenAt && Date.now() - hiddenAt > current.minutes * 60_000) {
        setLock(current);
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const open = () => {
    setLocked(false);
    setMounted(true);
  };

  return (
    <>
      {mounted && <div hidden={locked}>{children}</div>}
      {locked && lock && <LockScreen lock={lock} onUnlock={open} />}
    </>
  );
}

function LockScreen({ lock, onUnlock }: { lock: LockSettings; onUnlock: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string>();
  const [relock, setRelock] = useState(false);

  async function device() {
    setBusy(true);
    setMessage(undefined);
    try {
      await unlockWithDevice(lock);
      onUnlock();
    } catch {
      // Cancelled, or the credential is gone (new device, erased fingerprints): the browser
      // does not say which, so the way in with Google is offered either way.
      setFailed(true);
      setMessage('No se pudo verificar. Probá de nuevo o entrá con tu cuenta de Google.');
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setMessage(undefined);
    try {
      await unlockWithGoogle(lock);
      setRelock(true);
    } catch (err) {
      setMessage(
        err instanceof WrongAccountError ? err.message : 'Google no respondió. Probá de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function registerAgain() {
    setBusy(true);
    try {
      await enableLock(lock.minutes, { sub: lock.googleSub, email: lock.googleEmail });
    } catch {
      // The person can register it later from Ajustes; they are in either way.
    }
    onUnlock();
  }

  return (
    <main
      aria-label="Vuelto bloqueado"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-ground px-6 pt-safe pb-safe text-center"
    >
      <Wordmark />
      <div className="rel grid size-20 place-items-center rounded-[26px]">
        <Fingerprint aria-hidden className="size-9 text-hue" strokeWidth={1.75} />
      </div>
      {relock ? (
        <>
          <p className="max-w-[34ch] text-[15px] leading-relaxed text-muted">
            Entraste con Google. ¿Volvés a registrar la huella, la cara o el PIN de este
            dispositivo?
          </p>
          <div className="grid w-full max-w-[320px] gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void registerAgain()}
              className="rel go min-h-12 rounded-[16px] text-[15px] font-bold"
            >
              Registrar el bloqueo
            </button>
            <button
              type="button"
              onClick={onUnlock}
              className="min-h-11 text-[14px] font-medium text-hue"
            >
              Ahora no
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="max-w-[34ch] text-[15px] leading-relaxed text-muted">
            {message ?? 'Usá la huella, la cara o el PIN del dispositivo para ver tus datos.'}
          </p>
          <div className="grid w-full max-w-[320px] gap-2" aria-live="polite">
            <button
              type="button"
              disabled={busy}
              onClick={() => void device()}
              className="rel go min-h-12 rounded-[16px] text-[15px] font-bold"
            >
              {failed ? 'Reintentar' : 'Desbloquear'}
            </button>
            {failed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void google()}
                className="rel min-h-12 rounded-[16px] text-[15px] font-semibold"
              >
                Entrar con Google ({lock.googleEmail})
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
