import { CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from '../../ui/toast';
import { availability, PRODUCTION_ORIGIN } from './google';
import { useSync, type SyncStatus } from './useSync';

const ago = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
function since(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return ago.format(-min, 'minute');
  const h = Math.round(min / 60);
  return h < 48 ? ago.format(-h, 'hour') : ago.format(-Math.round(h / 24), 'day');
}

const statusText: Record<SyncStatus, (last?: number) => string> = {
  idle: () => 'Listo para sincronizar',
  syncing: () => 'Sincronizando…',
  synced: (last) => `Sincronizado ${last ? since(last) : ''}`,
  pending: () => 'Cambios por subir',
  offline: () => 'Sin conexión: se sube cuando vuelva',
  error: () => 'No se pudo sincronizar. Se reintenta solo.',
  reconnect: () => 'La sesión con Google venció',
};

/** Sign in to keep a copy in your own Google Drive and use Vuelto on several devices. */
export function GoogleSection() {
  const { profile, status, lastSyncAt, signIn, reconnect, signOut, syncNow } = useSync();
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = availability();

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast('Google no respondió. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <div className="p-4">
        <p className="text-[15px] font-medium">Sincronizá con tu Google Drive</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-faint">
          Tus datos se guardan en una carpeta privada de tu Drive que solo Vuelto puede ver. Sin
          iniciar sesión, todo queda en este dispositivo.{' '}
          <Link to="/privacidad" className="font-medium text-hue">
            Privacidad
          </Link>
        </p>
        {state === 'ready' ? (
          <button
            type="button"
            disabled={busy}
            onClick={run(signIn)}
            className="rel go mt-4 min-h-12 w-full rounded-[16px] text-[15px] font-bold"
          >
            Iniciar sesión con Google
          </button>
        ) : (
          <p className="well mt-4 rounded-[14px] px-4 py-3 text-[13.5px] leading-snug text-muted">
            <CloudOff aria-hidden className="mr-1.5 inline size-4 align-[-3px]" />
            {state === 'no-client'
              ? 'El inicio de sesión con Google todavía no está configurado en esta instalación. La app funciona igual, solo en este dispositivo.'
              : `El inicio de sesión funciona en ${PRODUCTION_ORIGIN.replace('https://', '')}. Esta versión de prueba guarda todo solo en este dispositivo.`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 p-4">
        {profile.picture ? (
          <img
            src={profile.picture}
            alt=""
            referrerPolicy="no-referrer"
            className="size-11 rounded-full"
          />
        ) : (
          <span className="grid size-11 place-items-center rounded-full bg-flat-2 text-[17px] font-semibold">
            {profile.email[0]?.toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">
            {profile.name ?? profile.email}
          </span>
          <span className="block truncate text-[13px] text-faint">{profile.email}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 border-t border-line px-4 py-3" aria-live="polite">
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${
            status === 'synced'
              ? 'bg-positive'
              : status === 'error' || status === 'reconnect'
                ? 'bg-over'
                : 'bg-idle'
          }`}
        />
        <span className="flex-1 text-[14px] text-muted">{statusText[status](lastSyncAt)}</span>
        {status === 'reconnect' ? (
          <button
            type="button"
            disabled={busy}
            onClick={run(reconnect)}
            className="rel min-h-10 rounded-full px-4 text-[13.5px] font-semibold text-hue"
          >
            Reconectar con Google
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || status === 'syncing'}
            onClick={run(syncNow)}
            className="rel flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold disabled:opacity-50"
          >
            <RefreshCw
              aria-hidden
              className={`size-4 ${status === 'syncing' ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
            Sincronizar ahora
          </button>
        )}
      </div>
      {leaving ? (
        <div className="grid gap-2 border-t border-line p-4">
          <p className="text-[14px] text-muted">
            ¿Qué hacemos con los datos de este dispositivo? En tu Drive quedan igual.
          </p>
          <button
            type="button"
            onClick={run(() => signOut(true))}
            className="rel min-h-12 rounded-[14px] text-[14.5px] font-semibold"
          >
            Cerrar sesión y conservarlos
          </button>
          <button
            type="button"
            onClick={run(() => signOut(false))}
            className="rel min-h-12 rounded-[14px] text-[14.5px] font-semibold text-negative"
          >
            Cerrar sesión y borrarlos de acá
          </button>
          <button
            type="button"
            onClick={() => setLeaving(false)}
            className="min-h-11 text-[14px] font-medium text-hue"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="hoverable flex min-h-13 w-full items-center gap-3 border-t border-line px-4 text-left text-[15px]"
        >
          <LogOut aria-hidden className="size-5 text-muted" /> Cerrar sesión
        </button>
      )}
    </div>
  );
}
