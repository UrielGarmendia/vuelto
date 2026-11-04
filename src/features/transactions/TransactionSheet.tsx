import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, ChevronDown, NotebookPen, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import type { Account, Category, Transaction } from '../../db/types';
import {
  amountInputToCents,
  applyAmountKey,
  centsToAmountInput,
  formatAmountInput,
  type AmountKey,
} from '../../lib/amountInput';
import { addDays, formatShortDay, todayISO } from '../../lib/dates';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { NumberPad } from '../../ui/NumberPad';
import { Sheet, SheetDragZone } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { saveTransaction } from './queries';
import { useLastUsed, useTxSheet } from './store';

type Kind = 'expense' | 'income';

const keyMap: Record<string, AmountKey> = { ',': ',', '.': ',', Backspace: 'back' };

export function TransactionSheet() {
  const { open, editingId, session, close } = useTxSheet();
  // `null` = new transaction; `undefined` = still loading the one being edited.
  const editing = useLiveQuery(
    async () => (editingId ? await db.transactions.get(editingId) : null),
    [editingId],
  );
  // Loaded here (always mounted) so the form opens with data instead of re-rendering mid-animation.
  const categories = useLiveQuery(
    () =>
      db.categories
        .orderBy('order')
        .filter((c) => !c.archived && !c.deleted)
        .toArray(),
    [],
  );
  const accounts = useLiveQuery(
    () =>
      db.accounts
        .orderBy('order')
        .filter((a) => !a.archived && !a.deleted)
        .toArray(),
    [],
  );
  const ready =
    editing !== undefined && (editing === null) === !editingId && !!categories && !!accounts;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={editingId ? 'Editar movimiento' : 'Nuevo movimiento'}
    >
      {ready && (
        <TxForm
          key={session}
          editing={editing ?? undefined}
          categories={categories}
          accounts={accounts}
          onDone={close}
        />
      )}
    </Sheet>
  );
}

function TxForm({
  editing,
  categories,
  accounts,
  onDone,
}: {
  editing?: Transaction;
  categories: Category[];
  accounts: Account[];
  onDone: () => void;
}) {
  const lastUsed = useLastUsed();
  const [type, setType] = useState<Kind>(editing?.type === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(() =>
    editing ? centsToAmountInput(editing.amountCents) : '',
  );
  const [categoryId, setCategoryId] = useState(
    editing ? editing.categoryId : lastUsed.expenseCategoryId,
  );
  const [accountId, setAccountId] = useState(editing ? editing.accountId : lastUsed.accountId);
  const [date, setDate] = useState(() => editing?.date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? '');
  const [showNote, setShowNote] = useState(!!editing?.note);
  const editingId = editing?.id;

  const visibleCategories = categories.filter((c) => c.type === type);
  const effectiveAccountId = accountId ?? accounts[0]?.id;
  const cents = amountInputToCents(amount);
  const canSave = cents > 0 && !!categoryId && !!effectiveAccountId;

  function switchType(next: Kind) {
    setType(next);
    setCategoryId(next === 'expense' ? lastUsed.expenseCategoryId : lastUsed.incomeCategoryId);
  }

  async function save() {
    if (!canSave) return;
    try {
      await saveTransaction(
        {
          type,
          amountCents: cents,
          currency: 'ARS',
          date,
          categoryId,
          accountId: effectiveAccountId!,
          note,
        },
        editingId,
      );
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar. Probá de nuevo.');
      return;
    }
    lastUsed.remember({
      [type === 'expense' ? 'expenseCategoryId' : 'incomeCategoryId']: categoryId,
      accountId: effectiveAccountId,
    });
    onDone();
    toast(
      editingId ? 'Cambios guardados' : type === 'expense' ? 'Gasto guardado' : 'Ingreso guardado',
    );
  }

  // Physical keyboard support (desktop, external keyboards); typing in the note is left alone.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Enter') return void save();
      const key = /^\d$/.test(e.key) ? (e.key as AmountKey) : keyMap[e.key];
      if (key) {
        e.preventDefault();
        setAmount((a) => applyAmountKey(a, key));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const today = todayISO();
  const yesterday = addDays(today, -1);
  const isOtherDay = date !== today && date !== yesterday;

  const header = (
    <SheetDragZone className="px-5 pb-3">
      <div
        className="mx-auto grid w-52 grid-cols-2 rounded-full bg-surface-2 p-1"
        role="radiogroup"
        aria-label="Tipo"
      >
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={type === k}
            onClick={() => switchType(k)}
            className="min-h-9 rounded-full text-sm font-medium text-muted transition-colors aria-checked:bg-raised aria-checked:text-ink aria-checked:shadow-soft"
          >
            {k === 'expense' ? 'Gasto' : 'Ingreso'}
          </button>
        ))}
      </div>
      <p
        aria-live="polite"
        aria-label={`Monto: ${formatAmountInput(amount)} pesos`}
        className={`tabular mt-3 truncate text-center text-[44px] leading-none font-semibold tracking-tight ${
          amount ? (type === 'expense' ? 'text-expense' : 'text-income') : 'text-muted/50'
        }`}
      >
        <span className="mr-1 align-[0.35em] text-[28px] font-medium">$</span>
        {formatAmountInput(amount)}
      </p>
    </SheetDragZone>
  );

  return (
    <>
      {header}
      {/* Categories keep a usable height; on short screens the whole sheet scrolls instead. */}
      <div className="flex flex-1 flex-col">
        <div className="min-h-[9.5rem] flex-1 overflow-y-auto overscroll-contain">
          <CategoryGrid
            categories={visibleCategories}
            selected={categoryId}
            onSelect={setCategoryId}
          />

          <div className="flex gap-2 overflow-x-auto px-5 pt-1 pb-2 [scrollbar-width:none]">
            <div
              className="flex shrink-0 rounded-full bg-surface-2 p-1"
              role="radiogroup"
              aria-label="Fecha"
            >
              {[
                { iso: today, label: 'Hoy' },
                { iso: yesterday, label: 'Ayer' },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  role="radio"
                  aria-checked={date === d.iso}
                  onClick={() => setDate(d.iso)}
                  className="min-h-9 rounded-full px-3.5 text-sm font-medium text-muted aria-checked:bg-raised aria-checked:text-ink aria-checked:shadow-soft"
                >
                  {d.label}
                </button>
              ))}
              <label
                className={`relative flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent-ink ${
                  isOtherDay ? 'bg-raised text-ink shadow-soft' : 'text-muted'
                }`}
              >
                <CalendarDays aria-hidden className="size-4" />
                {isOtherDay ? formatShortDay(date) : <span className="sr-only">Elegir fecha</span>}
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  aria-label="Elegir fecha"
                  className="absolute inset-0 opacity-0"
                />
              </label>
            </div>

            <label className="relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 pr-3 pl-3.5 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent-ink">
              <Wallet aria-hidden className="size-4 text-muted" />
              <span>{accounts.find((a) => a.id === effectiveAccountId)?.name ?? 'Cuenta'}</span>
              <ChevronDown aria-hidden className="size-4 text-muted" />
              <select
                aria-label="Cuenta"
                value={effectiveAccountId ?? ''}
                onChange={(e) => setAccountId(e.target.value)}
                className="absolute inset-0 opacity-0"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            {!showNote && (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm font-medium"
              >
                <NotebookPen aria-hidden className="size-4 text-muted" /> Nota
              </button>
            )}
          </div>

          {showNote && (
            <div className="px-5 pb-2">
              <input
                autoFocus={!editing}
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional)"
                aria-label="Nota"
                maxLength={140}
                enterKeyHint="done"
                className="min-h-11 w-full rounded-sm bg-surface-2 px-4 text-[16px] placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
              />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line px-4 pt-2 pb-3">
          <NumberPad onKey={(k) => setAmount((a) => applyAmountKey(a, k))} />
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="mt-2 min-h-13 w-full rounded-md bg-accent-ink text-[17px] font-semibold text-on-accent transition-opacity disabled:opacity-40"
          >
            {editingId ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  );
}

function CategoryGrid({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Categoría"
      className="grid snap-x auto-cols-[76px] grid-flow-col grid-rows-2 gap-x-1 gap-y-0.5 overflow-x-auto px-4 py-1 [scrollbar-width:none]"
    >
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={selected === c.id}
          onClick={() => onSelect(c.id)}
          className="group flex snap-start flex-col items-center gap-1 rounded-sm px-0.5 py-1"
        >
          <span
            className="rounded-[16px] ring-2 ring-transparent ring-offset-2 ring-offset-bg transition-shadow group-aria-checked:ring-[var(--c)]"
            style={{ '--c': c.color } as React.CSSProperties}
          >
            <CategoryIcon icon={c.icon} color={c.color} />
          </span>
          <span className="w-full truncate text-center text-[11px] leading-tight font-medium text-muted group-aria-checked:text-ink">
            {c.name}
          </span>
        </button>
      ))}
    </div>
  );
}
