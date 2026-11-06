import { BadgeCheck, Link2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { usePrefs } from '../../app/prefs';
import { formatMoney } from '../../lib/money';
import { toast } from '../../ui/toast';
import { useRates } from '../currency/rates';
import { dayChange, snapshotTotal, type Position, type Snapshot } from '../external/provider';
import { availability } from '../sync/google';
import { useSync } from '../sync/useSync';
import { connectIol, disconnectIol, IolError, takeIolFromUrl, useIol, useIolStatus } from './iol';

const ago = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
function since(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return ago.format(-min, 'minute');
  const h = Math.round(min / 60);
  return h < 48 ? ago.format(-h, 'hour') : ago.format(-Math.round(h / 24), 'day');
}
const pct = (p: number) =>
  `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(2).replace('.', ',')} %`;

const typeNames: Record<string, string> = {
  acciones: 'Acciones',
  cedears: 'CEDEARs',
  titulospublicos: 'Bonos',
  obligacionesnegociables: 'Obligaciones negociables',
  fondocomundeinversion: 'Fondos',
  letras: 'Letras',
  cauciones: 'Cauciones',
  opciones: 'Opciones',
};
// A fixed sequence of distinct hues for the distribution bar (asset classes have no colour).
const typeColors = ['#75AADB', '#8FD18A', '#E8A23A', '#B48EE0', '#E07A8C', '#5FC2B5', '#C9A66B'];

/** Linked IOL account: total, cash, today's change, distribution and movers. */
export function IolCard() {
  const iol = useIol();
  const { status, message, refresh } = useIolStatus();
  const signedIn = useSync((s) => !!s.profile);
  const rateKind = usePrefs((s) => s.rateKind);
  const rate = useRates()?.values[rateKind];
  const [confirm, setConfirm] = useState(false);

  // Back from IOL's authorization page (a fresh load, or a fragment change on the same page).
  useEffect(() => {
    const take = () =>
      void takeIolFromUrl().then((r) => {
        if (r === 'connected') {
          toast('IOL conectado');
          void useIolStatus.getState().refresh();
        } else if (r === 'error') toast('No se pudo conectar IOL. Probá de nuevo.');
      });
    take();
    addEventListener('hashchange', take);
    return () => removeEventListener('hashchange', take);
  }, []);

  // Refresh when the cached snapshot is older than ten minutes.
  const linked = !!iol?.account;
  const fetchedAt = iol?.snapshot?.fetchedAt;
  useEffect(() => {
    if (linked && signedIn && (!fetchedAt || Date.now() - fetchedAt > 10 * 60 * 1000))
      void useIolStatus.getState().refresh();
  }, [linked, signedIn, fetchedAt]);

  if (!iol) return null;

  if (!iol.account) {
    return (
      <section aria-labelledby="iol-title" className="mb-5 rounded-[22px] bg-flat p-5">
        <h2 id="iol-title" className="text-[16px] font-semibold">
          IOL — Inversiones
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          Mirá tu saldo y tu portafolio de InvertirOnline acá, en modo lectura. Vuelto no opera ni
          mueve plata, y nunca ve tu contraseña.
        </p>
        {signedIn ? (
          <button
            type="button"
            onClick={() =>
              void connectIol().catch((e: unknown) =>
                toast(e instanceof IolError ? e.message : 'No se pudo conectar IOL'),
              )
            }
            className="rel go mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] text-[15px] font-bold"
          >
            <Link2 aria-hidden className="size-4" /> Conectar IOL
          </button>
        ) : (
          <p className="mt-4 rounded-[14px] border border-line bg-flat-2 px-4 py-3 text-[13.5px] leading-snug text-muted">
            {availability() === 'ready' ? (
              <>
                Para conectar IOL primero{' '}
                <Link to="/ajustes" className="font-semibold text-hue">
                  iniciá sesión con Google
                </Link>
                : así la conexión queda atada a tu cuenta y llega a tus otros dispositivos.
              </>
            ) : (
              'Conectar IOL necesita el inicio de sesión con Google, que todavía no está disponible en esta instalación.'
            )}
          </p>
        )}
      </section>
    );
  }

  const s = iol.snapshot;
  const change = s ? dayChange(s) : undefined;

  return (
    <section aria-labelledby="iol-title" className="rel mb-5 rounded-[24px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="iol-title" className="flex items-center gap-2 text-[15px] font-semibold">
          IOL — Inversiones
          <span className="flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-[11.5px] font-medium text-hue">
            <BadgeCheck aria-hidden className="size-3.5" /> Vinculada
          </span>
        </h2>
        <button
          type="button"
          aria-label="Actualizar IOL"
          disabled={status === 'loading'}
          onClick={() => void refresh()}
          className="grid size-11 place-items-center rounded-full text-muted"
        >
          <RefreshCw
            aria-hidden
            className={`size-[18px] ${status === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''}`}
          />
        </button>
      </div>

      {s ? (
        <>
          <p className="wide mt-1 text-[clamp(28px,8vw,40px)] leading-tight font-extrabold">
            {formatMoney(snapshotTotal(s, rate))}
          </p>
          <p className="mt-1 text-[13px] text-faint" aria-live="polite">
            {status === 'loading' ? 'Actualizando…' : `Actualizado ${since(s.fetchedAt)}`}
            {!rate && (s.cash.USD > 0 || s.positions.some((p) => p.currency === 'USD'))
              ? ' · sin cotización, los dólares no suman'
              : ''}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[12.5px] text-muted">Disponible</dt>
              <dd className="tabular mt-0.5 text-[15px] font-semibold">
                {formatMoney(s.cash.ARS)}
                {s.cash.USD ? ` · ${formatMoney(s.cash.USD, 'USD')}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Hoy</dt>
              <dd
                className={`tabular mt-0.5 text-[15px] font-semibold ${
                  change === undefined ? '' : change >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {change === undefined ? '—' : pct(change)}
              </dd>
            </div>
          </dl>
          {s.positions.length > 0 && <Distribution positions={s.positions} rate={rate} />}
          {s.positions.length > 0 && <Movers snapshot={s} />}
        </>
      ) : (
        <p className="mt-2 text-[14px] text-muted">
          {status === 'loading' ? 'Trayendo tu cuenta…' : 'Todavía no hay datos.'}
        </p>
      )}

      {(status === 'error' || status === 'reconnect') && (
        <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-line bg-flat-2 px-4 py-3">
          <p className="flex-1 text-[13.5px] text-muted">{message}</p>
          {status === 'reconnect' && (
            <button
              type="button"
              onClick={() => void connectIol().catch(() => toast('No se pudo reconectar IOL'))}
              className="min-h-10 shrink-0 px-2 text-[13.5px] font-semibold text-hue"
            >
              Reconectar
            </button>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        {confirm ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-[13.5px] text-muted">¿Desconectar IOL de Vuelto?</p>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="min-h-10 px-3 text-[13.5px] font-medium text-hue"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void disconnectIol().then(() => toast('IOL desconectado'))}
              className="rel min-h-10 rounded-full px-4 text-[13.5px] font-semibold text-negative"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="min-h-10 text-[13.5px] font-medium text-faint"
          >
            Desconectar
          </button>
        )}
      </div>
    </section>
  );
}

function Distribution({ positions, rate }: { positions: Position[]; rate?: number }) {
  const ars = (p: Position) =>
    p.currency === 'ARS' ? p.valueCents : rate ? Math.round(p.valueCents * rate) : 0;
  const byType = new Map<string, number>();
  for (const p of positions) byType.set(p.type, (byType.get(p.type) ?? 0) + ars(p));
  const parts = [...byType].sort((a, b) => b[1] - a[1]);
  const total = parts.reduce((a, [, v]) => a + v, 0);
  if (!total) return null;
  return (
    <div className="mt-5">
      <p className="text-[13px] font-semibold text-muted">Por tipo</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map(([t, v], i) => (
          <span
            key={t}
            style={{
              width: `${(v / total) * 100}%`,
              background: typeColors[i % typeColors.length],
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {parts.map(([t, v], i) => (
          <li key={t} className="flex items-center gap-2 text-[13.5px]">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{ background: typeColors[i % typeColors.length] }}
            />
            <span className="flex-1 truncate">{typeNames[t] ?? t}</span>
            <span className="tabular text-muted">{Math.round((v / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Movers({ snapshot }: { snapshot: Snapshot }) {
  const moved = snapshot.positions
    .filter((p) => p.dayChangePct !== undefined && p.dayChangePct !== 0)
    .sort((a, b) => b.dayChangePct! - a.dayChangePct!);
  if (moved.length < 2) return null;
  const up = moved.filter((p) => p.dayChangePct! > 0).slice(0, 3);
  const down = moved
    .filter((p) => p.dayChangePct! < 0)
    .slice(-3)
    .reverse();
  const list = (items: Position[], Icon: typeof TrendingUp, tone: string, title: string) =>
    items.length > 0 && (
      <div>
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <Icon aria-hidden className={`size-4 ${tone}`} /> {title}
        </p>
        <ul className="mt-1.5 grid gap-1">
          {items.map((p) => (
            <li key={p.symbol} className="flex items-center justify-between text-[13.5px]">
              <span className="truncate">{p.symbol}</span>
              <span className={`tabular ${tone}`}>{pct(p.dayChangePct!)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="mt-5 grid grid-cols-2 gap-4">
      {list(up, TrendingUp, 'text-positive', 'Suben hoy')}
      {list(down, TrendingDown, 'text-negative', 'Bajan hoy')}
    </div>
  );
}
