import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import type { Goal } from '../../db/types';
import { fromISODate, todayISO } from '../../lib/dates';
import { formatMoney, parseCents } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { ColorPicker } from '../../ui/Pickers';
import { toast } from '../../ui/toast';
import { GoalRing } from './GoalRing';
import { contribute, monthlyNeeded, saveGoal } from './goals';

const monthYear = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });

export function GoalsPage() {
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.deleted).toArray(), []);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/ajustes" label="Ajustes" />
      <h1 className="mt-2 text-[22px] font-bold">Metas de ahorro</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        Separá plata para algo puntual y mirá cuánto te falta. No mueve tus cuentas.
      </p>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {goals?.map((g) => (
          <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />
        ))}
      </ul>

      {editing ? (
        <GoalForm
          key={editing === 'new' ? 'new' : editing.id}
          goal={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rel mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] font-semibold"
        >
          <Plus aria-hidden className="size-4" /> Nueva meta
        </button>
      )}
    </div>
  );
}

function GoalCard({ goal: g, onEdit }: { goal: Goal; onEdit: () => void }) {
  const [amount, setAmount] = useState('');
  const cents = parseCents(amount || '0') ?? 0;
  const per = monthlyNeeded(g, todayISO());
  const done = g.savedCents >= g.targetCents;

  async function move(sign: 1 | -1) {
    if (cents <= 0) return;
    const reached =
      sign > 0 && g.savedCents < g.targetCents && g.savedCents + cents >= g.targetCents;
    await contribute(g.id, sign * cents);
    setAmount('');
    toast(reached ? `¡Llegaste a ${g.name}!` : sign > 0 ? 'Sumado a la meta' : 'Sacado de la meta');
  }

  return (
    <li className="rel rounded-[22px] p-5">
      <div className="flex items-center gap-4">
        <GoalRing goal={g} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{g.name}</p>
          <p className="tabular text-[14px] text-muted">
            {formatMoney(g.savedCents)} de {formatMoney(g.targetCents)}
          </p>
          <p className="text-[12.5px] text-faint">
            {done
              ? 'Meta cumplida'
              : g.deadline
                ? `${per ? `${formatMoney(per)} por mes · ` : ''}para ${monthYear.format(fromISODate(g.deadline))}`
                : `Faltan ${formatMoney(g.targetCents - g.savedCents)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 px-2 text-[13.5px] font-medium text-hue"
        >
          Editar
        </button>
      </div>
      <form
        className="mt-4 grid grid-cols-2 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void move(1);
        }}
      >
        <label className="well col-span-2 flex min-h-11 min-w-0 items-center gap-1.5 rounded-[14px] px-3 has-focus-visible:outline-2 has-focus-visible:outline-hue">
          <span className="text-muted">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Monto"
            aria-label={`Monto para ${g.name}`}
            className="tabular min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
        </label>
        <button
          type="button"
          disabled={cents <= 0 || g.savedCents === 0}
          onClick={() => void move(-1)}
          className="rel min-h-11 rounded-[14px] px-3 text-[13.5px] font-semibold disabled:opacity-40"
        >
          Sacar
        </button>
        <button
          type="submit"
          disabled={cents <= 0}
          className="rel go min-h-11 rounded-[14px] px-4 text-[13.5px] font-bold"
        >
          Sumar
        </button>
      </form>
    </li>
  );
}

function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(
    goal ? String(goal.targetCents / 100).replace('.', ',') : '',
  );
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [color, setColor] = useState(goal?.color ?? '#75AADB');
  const cents = parseCents(target || '0') ?? 0;
  const ok = name.trim().length > 0 && cents > 0;

  return (
    <form
      className="mt-5 grid gap-4 rounded-[22px] bg-flat p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        await saveGoal(
          { name, targetCents: cents, color, deadline: deadline || undefined },
          goal?.id,
        );
        toast(goal ? 'Meta guardada' : 'Meta creada');
        onDone();
      }}
    >
      <h2 className="text-[16px] font-semibold">{goal ? 'Editar meta' : 'Nueva meta'}</h2>
      <label className="grid gap-1.5">
        <span className="text-[13.5px] font-medium text-muted">Nombre</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Vacaciones, fondo de emergencia…"
          className="well min-h-12 rounded-[14px] px-4 text-[16px] outline-none focus-visible:outline-2 focus-visible:outline-hue"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5">
          <span className="text-[13.5px] font-medium text-muted">Objetivo</span>
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0"
            className="tabular well min-h-12 rounded-[14px] px-4 text-[16px] outline-none focus-visible:outline-2 focus-visible:outline-hue"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[13.5px] font-medium text-muted">Para cuándo (opcional)</span>
          <input
            type="date"
            value={deadline}
            min={todayISO()}
            onChange={(e) => setDeadline(e.target.value)}
            className="well min-h-12 rounded-[14px] px-3 text-[15px] outline-none focus-visible:outline-2 focus-visible:outline-hue"
          />
        </label>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[13.5px] font-medium text-muted">Color</legend>
        <ColorPicker value={color} onChange={setColor} />
      </fieldset>
      <div className="flex gap-3">
        {goal && (
          <button
            type="button"
            onClick={async () => {
              await db.goals.update(goal.id, { deleted: 1, updatedAt: Date.now(), synced: 0 });
              toast('Meta borrada');
              onDone();
            }}
            className="rel min-h-12 rounded-[16px] px-4 text-[14px] font-semibold text-negative"
          >
            Borrar
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className="min-h-12 px-3 text-[14px] font-medium text-hue"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!ok}
          className="rel go ml-auto min-h-12 rounded-[16px] px-6 text-[15px] font-bold"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
