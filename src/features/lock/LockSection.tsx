import { useEffect, useState } from 'react';
import { toast } from '../../ui/toast';
import { useSync } from '../sync/useSync';
import { enableLock, LOCK_MINUTES, lockAvailable, readLock, writeLock } from './lock';

const SWITCH =
  'well relative h-8 w-[52px] shrink-0 rounded-full transition-colors peer-checked:bg-hue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hue after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-[linear-gradient(145deg,var(--color-face-a),var(--color-face-b))] after:shadow-[var(--rise)] after:transition-transform after:duration-300 after:ease-[var(--ease-spring)] peer-checked:after:translate-x-5';

// Asked once: on a later visit the section is there from the first frame, so a restored
// scroll position is not pushed down when it appears.
let known: boolean | undefined;
const checked = lockAvailable().then((v) => (known = v));

/** Ajustes → Seguridad. Absent on devices without their own unlock. */
export function LockSection() {
  const [available, setAvailable] = useState(known ?? false);
  const [lock, setLock] = useState(readLock);
  const [busy, setBusy] = useState(false);
  const profile = useSync((s) => s.profile);

  useEffect(() => {
    void checked.then(setAvailable);
  }, []);

  if (!available) return null;

  async function toggle(on: boolean) {
    if (!on) {
      writeLock(undefined);
      setLock(undefined);
      toast('Bloqueo desactivado');
      return;
    }
    if (!profile) return;
    setBusy(true);
    try {
      await enableLock(5, { sub: profile.sub, email: profile.email });
      setLock(readLock());
      toast('Bloqueo activado');
    } catch (err) {
      console.error(err);
      toast('El dispositivo no registró el bloqueo. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="security-title">
      <h2 id="security-title" className="mb-2 px-1 text-[13px] font-semibold text-muted">
        Seguridad
      </h2>
      <div className="overflow-hidden rounded-[22px] bg-flat">
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-3">
          <span>
            <span className="block text-[15px]">Bloquear con huella, cara o PIN</span>
            <span className="block text-[13px] text-faint">
              {profile
                ? `Pide desbloquear al abrir. Si el dispositivo no te reconoce, entrás con ${profile.email}.`
                : 'Para activarlo, iniciá sesión con Google: es tu forma de entrar si el dispositivo no te reconoce.'}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={!!lock}
            disabled={busy || (!lock && !profile)}
            onChange={(e) => void toggle(e.target.checked)}
            className="peer sr-only"
          />
          <span aria-hidden className={`${SWITCH} peer-disabled:opacity-40`} />
        </label>
        {lock && (
          <label className="flex min-h-14 items-center justify-between gap-4 border-t border-line px-4 py-3">
            <span className="text-[15px]">Volver a pedirlo después de</span>
            <select
              value={lock.minutes}
              onChange={(e) => {
                const next = { ...lock, minutes: Number(e.target.value) };
                writeLock(next);
                setLock(next);
              }}
              className="well min-h-11 rounded-[12px] px-3 text-[15px]"
            >
              {LOCK_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? 'minuto' : 'minutos'} afuera
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
