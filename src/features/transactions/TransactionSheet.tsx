import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  CalendarDays,
  ChevronDown,
  CreditCard,
  NotebookPen,
  Repeat,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePrefs } from '../../app/prefs';
import { db, newMeta } from '../../db/db';
import type { Account, Category, Template, Transaction, TxType } from '../../db/types';
import {
  amountInputToCents,
  applyAmountKey,
  centsToAmountInput,
  formatAmountInput,
  type AmountKey,
} from '../../lib/amountInput';
import { addDays, formatShortDay, todayISO } from '../../lib/dates';
import { arsCents, formatMoney } from '../../lib/money';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { NumberPad } from '../../ui/NumberPad';
import { Sheet, SheetDragZone } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { budgetsFor, crossedThreshold } from '../budgets/budgets';
import { rateLabels, useRates } from '../currency/rates';
import { createTransaction, updateGroup } from './create';
import { saveTransaction, splitShare, type TxDraft } from './queries';
import type { Frequency } from './schedule';
import { useLastUsed, useTxSheet } from './store';

const keyMap: Record<string, AmountKey> = { ',': ',', '.': ',', Backspace: 'back' };
const typeLabels: Record<TxType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
};
const repeatLabels: Record<Frequency, string> = {
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada año',
};

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
        .filter((a) => !a.archived && !a.deleted && a.kind !== 'investment')
        .toArray(),
    [],
  );
  const templates = useLiveQuery(
    () =>
      db.templates
        .orderBy('order')
        .filter((t) => !t.deleted)
        .toArray(),
    [],
  );
  const ready =
    editing !== undefined &&
    (editing === null) === !editingId &&
    !!categories &&
    !!accounts &&
    !!templates;

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
          templates={templates}
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
  templates,
  onDone,
}: {
  editing?: Transaction;
  categories: Category[];
  accounts: Account[];
  templates: Template[];
  onDone: () => void;
}) {
  const lastUsed = useLastUsed();
  const rateKind = usePrefs((s) => s.rateKind);
  const rates = useRates();
  // Remembered ids may point to something archived or gone (e.g. after a restore).
  const usable = (id: string | undefined, type: TxType) =>
    categories.some((c) => c.id === id && c.type === type) ? id : undefined;
  const known = (id: string | undefined) => (accounts.some((a) => a.id === id) ? id : undefined);
  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [amount, setAmount] = useState(() =>
    editing ? centsToAmountInput(editing.split?.totalCents ?? editing.amountCents) : '',
  );
  const [categoryId, setCategoryId] = useState(
    editing ? editing.categoryId : usable(lastUsed.expenseCategoryId, 'expense'),
  );
  const [accountId, setAccountId] = useState(
    editing ? editing.accountId : known(lastUsed.accountId),
  );
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId);
  const [date, setDate] = useState(() => editing?.date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? '');
  const [showNote, setShowNote] = useState(!!editing?.note);
  const [installments, setInstallments] = useState(1);
  const [repeat, setRepeat] = useState<Frequency | ''>('');
  const [favorite, setFavorite] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [people, setPeople] = useState(editing?.split?.people ?? 1);
  const editingId = editing?.id;

  const visibleCategories = categories.filter((c) => c.type === type);
  const account = accounts.find((a) => a.id === (accountId ?? accounts[0]?.id));
  const destinations = accounts.filter(
    (a) => a.id !== account?.id && a.currency === account?.currency,
  );
  const destination = destinations.find((a) => a.id === toAccountId) ?? destinations[0];
  const currency = account?.currency ?? 'ARS';
  const rate = currency === 'USD' ? rates?.values[rateKind] : undefined;
  const typed = amountInputToCents(amount);
  const splitting = type === 'expense' && people > 1;
  // While splitting, the keypad holds the whole bill and the movement keeps your part.
  const cents = splitting ? splitShare(typed, people) : typed;
  const canSave = cents > 0 && !!account && (type === 'transfer' ? !!destination : !!categoryId);
  const canSplit = !editing && type === 'expense' && account?.kind === 'credit';

  function switchType(next: TxType) {
    setType(next);
    if (next !== 'transfer')
      setCategoryId(
        usable(next === 'expense' ? lastUsed.expenseCategoryId : lastUsed.incomeCategoryId, next),
      );
  }

  function applyTemplate(t: Template) {
    setType(t.type);
    if (t.amountCents) setAmount(centsToAmountInput(t.amountCents));
    setCategoryId(t.categoryId);
    setAccountId(known(t.accountId));
    setToAccountId(t.toAccountId);
    setNote(t.note ?? '');
    setShowNote(!!t.note);
  }

  async function save() {
    if (!canSave || !account) return;
    const draft: TxDraft = {
      type,
      amountCents: cents,
      currency,
      // The dollar of the day is kept with the movement, so its peso value never drifts.
      rateAtDate: currency === 'USD' ? (editing?.rateAtDate ?? rate) : undefined,
      date,
      categoryId: type === 'transfer' ? undefined : categoryId,
      accountId: account.id,
      toAccountId: type === 'transfer' ? destination?.id : undefined,
      note,
      split: splitting ? { totalCents: typed, people } : undefined,
    };
    try {
      if (editingId) {
        await saveTransaction(draft, editingId);
        if (applyAll && editing?.installment)
          await updateGroup(editing.installment.groupId, {
            categoryId: draft.categoryId,
            accountId: draft.accountId,
            note,
          });
      } else {
        await createTransaction(draft, {
          installments: canSplit ? installments : 1,
          repeat: repeat || undefined,
        });
        if (favorite) await saveTemplate(draft, categories);
      }
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar. Probá de nuevo.');
      return;
    }
    lastUsed.remember({
      ...(type === 'transfer'
        ? {}
        : { [type === 'expense' ? 'expenseCategoryId' : 'incomeCategoryId']: categoryId }),
      accountId: account.id,
    });
    onDone();
    const budgetNote =
      type === 'expense' && !editingId && categoryId
        ? await budgetMessage(categoryId, date, arsCents(draft), categories)
        : null;
    toast(
      budgetNote ??
        (editingId
          ? 'Cambios guardados'
          : installments > 1 && canSplit
            ? `Compra en ${installments} cuotas guardada`
            : `${typeLabels[type]} guardad${type === 'transfer' ? 'a' : 'o'}`),
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
  const symbol = currency === 'USD' ? 'US$' : '$';

  const header = (
    <SheetDragZone className="px-4 pb-3">
      <div
        className="well mx-auto grid w-full max-w-[340px] grid-cols-3 gap-1 rounded-full p-[5px]"
        role="radiogroup"
        aria-label="Tipo"
      >
        {(['expense', 'income', 'transfer'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={type === k}
            disabled={!!editing?.installment && k !== 'expense'}
            onClick={() => switchType(k)}
            className={`min-h-9 rounded-full px-1 text-[13.5px] text-muted transition-colors disabled:opacity-40 aria-checked:font-semibold aria-checked:text-ink ${type === k ? 'rel' : ''}`}
          >
            {typeLabels[k]}
          </button>
        ))}
      </div>
      <p
        aria-live="polite"
        aria-label={`Monto: ${formatAmountInput(amount)} ${currency === 'USD' ? 'dólares' : 'pesos'}`}
        className={`wide mt-5 mb-1 truncate text-center text-[clamp(40px,13vw,56px)] leading-none font-extrabold ${
          amount ? (type === 'income' ? 'text-positive' : 'text-ink') : 'text-faint'
        }`}
      >
        <span className="mr-1.5 align-[0.5em] text-[0.45em] font-medium text-muted">{symbol}</span>
        {formatAmountInput(amount)}
      </p>
      {currency === 'USD' && (
        <p className="text-center text-[12.5px] text-faint">
          {rate
            ? `≈ ${formatMoney(Math.round(cents * rate))} al dólar ${rateLabels[rateKind]} (${formatMoney(Math.round(rate * 100))})`
            : 'Sin cotización todavía: no va a sumar a los totales en pesos.'}
        </p>
      )}
      {installments > 1 && canSplit && cents > 0 && (
        <p className="text-center text-[12.5px] text-faint">
          {installments} cuotas de {formatMoney(Math.trunc(cents / installments))}
        </p>
      )}
      {splitting && typed > 0 && (
        <p className="text-center text-[12.5px] text-faint">
          Tu parte: {formatMoney(cents)} de {formatMoney(typed)} entre {people}
        </p>
      )}
      {editing?.installment && (
        <p className="text-center text-[12.5px] text-faint">
          Cuota {editing.installment.number} de {editing.installment.total}
        </p>
      )}
    </SheetDragZone>
  );

  const chip =
    'well relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-3.5 text-[13.5px] font-medium has-focus-visible:outline-2 has-focus-visible:outline-hue';

  return (
    <>
      {header}
      {/* Categories keep a usable height; on short screens the whole sheet scrolls instead. */}
      <div className="flex flex-1 flex-col">
        <div className="min-h-[9.5rem] flex-1 overflow-y-auto overscroll-contain">
          {!editing && templates.length > 0 && (
            <div
              className="no-scrollbar fade-x flex gap-2 overflow-x-auto px-4 pb-2"
              role="group"
              aria-label="Favoritos"
            >
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-flat px-3 text-[13px]"
                >
                  <Star aria-hidden className="size-3.5 fill-current text-over" />
                  {t.name}
                  {t.amountCents ? (
                    <span className="tabular text-faint">{formatMoney(t.amountCents)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {type === 'transfer' ? (
            <div className="grid gap-2 px-4 py-1.5">
              <AccountSelect
                label="Desde"
                value={account?.id}
                accounts={accounts}
                onChange={setAccountId}
              />
              <ArrowDown aria-hidden className="mx-auto size-4 text-faint" />
              {destinations.length ? (
                <AccountSelect
                  label="Hacia"
                  value={destination?.id}
                  accounts={destinations}
                  onChange={setToAccountId}
                />
              ) : (
                <p className="rounded-[16px] bg-flat px-4 py-3 text-[13.5px] text-muted">
                  Para transferir hace falta otra cuenta en la misma moneda.
                </p>
              )}
            </div>
          ) : (
            <CategoryGrid
              categories={visibleCategories}
              selected={categoryId}
              onSelect={setCategoryId}
            />
          )}

          <div className="no-scrollbar fade-x flex gap-2 overflow-x-auto px-4 pt-2 pb-2">
            <div
              className="well flex shrink-0 rounded-full p-1"
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
                  className="min-h-9 rounded-full px-3.5 text-[13.5px] font-medium text-muted aria-checked:bg-flat-2 aria-checked:text-ink"
                >
                  {d.label}
                </button>
              ))}
              <label
                className={`relative flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium has-focus-visible:outline-2 has-focus-visible:outline-hue ${
                  isOtherDay ? 'bg-flat-2 text-ink' : 'text-muted'
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

            {type !== 'transfer' && (
              <label className={chip}>
                <Wallet aria-hidden className="size-4 text-muted" />
                <span>{account?.name ?? 'Cuenta'}</span>
                <ChevronDown aria-hidden className="size-4 text-muted" />
                <select
                  aria-label="Cuenta"
                  value={account?.id ?? ''}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="absolute inset-0 opacity-0"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.currency !== 'ARS' ? ` (${a.currency})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {canSplit && (
              <label className={`${chip} ${installments > 1 ? 'text-hue' : ''}`}>
                <CreditCard aria-hidden className="size-4" />
                <span>{installments > 1 ? `${installments} cuotas` : 'Cuotas'}</span>
                <select
                  aria-label="Cuotas"
                  value={installments}
                  onChange={(e) => {
                    setInstallments(Number(e.target.value));
                    setRepeat('');
                  }}
                  className="absolute inset-0 opacity-0"
                >
                  {[1, 2, 3, 6, 9, 12, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? 'Sin cuotas' : `${n} cuotas`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!editing && installments === 1 && (
              <label className={`${chip} ${repeat ? 'text-hue' : ''}`}>
                <Repeat aria-hidden className="size-4" />
                <span>{repeat ? repeatLabels[repeat] : 'Repetir'}</span>
                <select
                  aria-label="Repetir"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as Frequency | '')}
                  className="absolute inset-0 opacity-0"
                >
                  <option value="">No repetir</option>
                  {(Object.keys(repeatLabels) as Frequency[]).map((f) => (
                    <option key={f} value={f}>
                      {repeatLabels[f]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {type === 'expense' && (
              <label className={`${chip} ${splitting ? 'text-hue' : ''}`}>
                <Users aria-hidden className="size-4" />
                <span>{splitting ? `Entre ${people}` : 'Dividir'}</span>
                <select
                  aria-label="Dividir"
                  value={people}
                  onChange={(e) => setPeople(Number(e.target.value))}
                  className="absolute inset-0 opacity-0"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? 'No dividir' : `Entre ${n} personas`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!showNote && (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="well flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium"
              >
                <NotebookPen aria-hidden className="size-4 text-muted" /> Nota
              </button>
            )}

            {!editing && (
              <button
                type="button"
                aria-pressed={favorite}
                onClick={() => setFavorite(!favorite)}
                className="well flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium aria-pressed:text-over"
              >
                <Star
                  aria-hidden
                  className={`size-4 ${favorite ? 'fill-current' : 'text-muted'}`}
                />
                Favorito
              </button>
            )}
          </div>

          {showNote && (
            <div className="px-4 pb-2">
              <input
                autoFocus={!editing}
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional). Usá #etiquetas"
                aria-label="Nota"
                maxLength={140}
                enterKeyHint="done"
                className="well min-h-11 w-full rounded-[14px] px-4 text-[16px] placeholder:text-faint focus-visible:outline-2 focus-visible:outline-hue"
              />
            </div>
          )}

          {editing?.installment && (
            <label className="mx-4 mb-2 flex min-h-11 items-center gap-3 text-[13.5px]">
              <input
                type="checkbox"
                checked={applyAll}
                onChange={(e) => setApplyAll(e.target.checked)}
                className="size-5 accent-[var(--color-hue)]"
              />
              Aplicar categoría, cuenta y nota a todas las cuotas
            </label>
          )}
        </div>

        <div className="shrink-0 px-4 pt-3 pb-3">
          <NumberPad onKey={(k) => setAmount((a) => applyAmountKey(a, k))} />
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rel go mt-3.5 min-h-[56px] w-full rounded-[20px] text-[16px] font-bold"
          >
            {editingId
              ? 'Guardar cambios'
              : type === 'expense'
                ? 'Guardar gasto'
                : type === 'income'
                  ? 'Guardar ingreso'
                  : 'Guardar transferencia'}
          </button>
        </div>
      </div>
    </>
  );
}

function AccountSelect({
  label,
  value,
  accounts,
  onChange,
}: {
  label: string;
  value?: string;
  accounts: Account[];
  onChange: (id: string) => void;
}) {
  const current = accounts.find((a) => a.id === value);
  return (
    <label className="relative flex min-h-[52px] items-center gap-3 rounded-[16px] bg-flat px-4 has-focus-visible:outline-2 has-focus-visible:outline-hue">
      <span className="w-12 text-[13px] text-muted">{label}</span>
      <span className="flex-1 truncate text-[15px] font-semibold">{current?.name ?? '—'}</span>
      <ChevronDown aria-hidden className="size-4 text-muted" />
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
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
      className="no-scrollbar fade-x grid snap-x scroll-px-4 auto-cols-[78px] grid-flow-col grid-rows-2 gap-x-1.5 gap-y-1.5 overflow-x-auto px-4 py-1.5"
      // A mouse wheel scrolls the strip sideways (desktop has no swipe).
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={selected === c.id}
          onClick={() => onSelect(c.id)}
          className="group flex snap-start flex-col items-center gap-1.5 rounded-[18px] px-0.5 pt-2 pb-1.5 transition-[background-color,box-shadow] aria-checked:bg-sunk aria-checked:shadow-[var(--press)]"
        >
          <CategoryIcon icon={c.icon} color={c.color} />
          <span className="w-full truncate text-center text-[11px] leading-tight font-medium text-muted group-aria-checked:text-ink">
            {c.name}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Saves the movement as a one-tap favorite, named after its note or category. */
async function saveTemplate(draft: TxDraft, categories: Category[]) {
  const order = (await db.templates.count()) + 1;
  await db.templates.add({
    ...newMeta(),
    name:
      draft.note?.trim() ||
      categories.find((c) => c.id === draft.categoryId)?.name ||
      typeLabels[draft.type],
    type: draft.type,
    amountCents: draft.amountCents,
    categoryId: draft.categoryId,
    accountId: draft.accountId,
    toAccountId: draft.toAccountId,
    note: draft.note?.trim() || undefined,
    order,
  });
}

/** "Llegaste al 80 % de Supermercado" when this expense crossed a threshold of its budget. */
async function budgetMessage(
  categoryId: string,
  date: string,
  addedCents: number,
  categories: Category[],
): Promise<string | null> {
  const month = date.slice(0, 7);
  const budget = budgetsFor(await db.budgets.toArray(), month).get(categoryId);
  if (!budget) return null;
  const rows = await db.transactions
    .where('[categoryId+date]')
    .between([categoryId, `${month}-01`], [categoryId, `${month}-31`], true, true)
    .toArray();
  const after = rows
    .filter((t) => !t.deleted && t.type === 'expense')
    .reduce((a, t) => a + arsCents(t), 0);
  const name = categories.find((c) => c.id === categoryId)?.name ?? 'esta categoría';
  const hit = crossedThreshold(after - addedCents, after, budget);
  if (hit === 100) return `Te pasaste del presupuesto de ${name}`;
  if (hit === 80) return `Llegaste al 80 % del presupuesto de ${name}`;
  return null;
}
