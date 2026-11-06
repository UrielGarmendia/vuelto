import { useLiveQuery } from 'dexie-react-hooks';
import { GripVertical, Plus } from 'lucide-react';
import { m, useDragControls, useReducedMotion, useSpring } from 'motion/react';
import { Reorder } from 'motion/react-m';
import { useState, type PointerEvent } from 'react';
import { usePrefs } from '../../app/prefs';
import { setArchived } from '../../db/catalog';
import { db } from '../../db/db';
import type { Account } from '../../db/types';
import { formatMoney } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { accountBalances } from '../home/summary';
import { useOrder } from '../categories/useOrder';
import { AccountSheet } from './AccountSheet';
import { accountKinds } from './kinds';

export function AccountsPage() {
  const [sheet, setSheet] = useState<{ open: boolean; account?: Account; session: number }>({
    open: false,
    session: 0,
  });
  const all = useLiveQuery(
    () =>
      db.accounts
        .orderBy('order')
        .filter((a) => !a.deleted)
        .toArray(),
    [],
  );
  const txs = useLiveQuery(() => db.transactions.where('deleted').equals(0).toArray(), []);
  const active = all?.filter((a) => !a.archived) ?? [];
  const archived = all?.filter((a) => a.archived) ?? [];
  const balances = all && txs ? accountBalances(all, txs) : new Map<string, number>();
  const byId = new Map(active.map((a) => [a.id, a]));
  const [ids, onReorder] = useOrder(
    'accounts',
    active.map((a) => a.id),
  );

  const open = (account?: Account) =>
    setSheet((s) => ({ open: true, account, session: s.session + 1 }));

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/ajustes" label="Ajustes" />
      <h1 className="mt-2 text-[22px] font-bold">Cuentas</h1>
      <p id="accounts-hint" className="mt-2 mb-3 text-[13.5px] text-faint">
        Tocá una cuenta para editarla. Arrastrá desde la manija para reordenar (con teclado: Enter
        edita, Espacio agarra y las flechas mueven).
      </p>

      <Reorder.Group
        axis="y"
        values={ids}
        onReorder={onReorder}
        className="grid gap-4 sm:grid-cols-2"
        aria-describedby="accounts-hint"
      >
        {ids.map((id) => {
          const a = byId.get(id);
          return a ? (
            <AccountCard
              key={id}
              account={a}
              balance={balances.get(id) ?? 0}
              onOpen={() => open(a)}
            />
          ) : null;
        })}
      </Reorder.Group>

      <button
        type="button"
        onClick={() => open()}
        className="rel mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] font-semibold"
      >
        <Plus aria-hidden className="size-4" /> Nueva cuenta
      </button>

      {archived.length > 0 && (
        <section aria-labelledby="archived-accounts" className="mt-8">
          <h2 id="archived-accounts" className="mb-2 px-1 text-[13px] font-semibold text-muted">
            Archivadas
          </h2>
          <ul className="divide-y divide-line rounded-[22px] bg-flat">
            {archived.map((a) => (
              <li key={a.id} className="flex min-h-14 items-center gap-3 px-4 opacity-70">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <span className="flex-1 truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => void setArchived('accounts', a.id, 0)}
                  className="min-h-11 rounded-sm px-3 text-sm font-semibold text-hue"
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AccountSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        account={sheet.account}
        session={sheet.session}
      />
    </div>
  );
}

const MAX_TILT = 8; // degrees

function AccountCard({
  account: a,
  balance,
  onOpen,
}: {
  account: Account;
  balance: number;
  onOpen: () => void;
}) {
  const controls = useDragControls();
  const systemReduce = useReducedMotion();
  const appReduce = usePrefs((s) => s.reduceMotion);
  const rotateX = useSpring(0, { stiffness: 300, damping: 30 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 30 });
  const Kind = accountKinds[a.kind];

  // Tilt follows the pointer (or finger) across the card, iOS Wallet style.
  function tilt(e: PointerEvent<HTMLElement>) {
    if (systemReduce || appReduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    rotateY.set(((e.clientX - r.left) / r.width - 0.5) * 2 * MAX_TILT);
    rotateX.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * MAX_TILT);
  }
  function reset() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <Reorder.Item
      value={a.id}
      dragListener={false}
      dragControls={controls}
      aria-label={`${a.name}, ${formatMoney(balance, a.currency)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen();
      }}
      className="list-none [perspective:800px]"
    >
      <m.div
        style={{ rotateX, rotateY }}
        onPointerMove={tilt}
        onPointerLeave={reset}
        onPointerCancel={reset}
        className="rel rounded-[22px]"
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={onOpen}
          className="relative flex aspect-[2.1] w-full flex-col justify-between rounded-[22px] p-5 text-left [container-type:inline-size]"
        >
          <span className="flex items-center gap-2.5 text-[13.5px] text-muted">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-[10px]"
              style={{
                color: a.color,
                backgroundColor: `color-mix(in oklab, ${a.color} 20%, transparent)`,
              }}
            >
              <Kind.icon className="size-4" />
            </span>
            {Kind.label}
            {a.currency !== 'ARS' && <span>· {a.currency}</span>}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold">{a.name}</span>
            <span
              className={`wide mt-1 block truncate leading-tight font-extrabold ${balance < 0 ? 'text-negative' : ''}`}
              style={{ fontSize: 'min(30px, 9cqw)' }}
            >
              {balance < 0 ? '−' : ''}
              {formatMoney(Math.abs(balance), a.currency)}
            </span>
          </span>
        </button>
        <span
          aria-hidden
          onPointerDown={(e) => controls.start(e)}
          className="absolute top-2 right-2 grid size-11 cursor-grab touch-none place-items-center text-faint"
        >
          <GripVertical className="size-5" />
        </span>
      </m.div>
    </Reorder.Item>
  );
}
