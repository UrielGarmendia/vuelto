import { Archive } from 'lucide-react';
import { useState } from 'react';
import { saveAccount, setArchived } from '../../db/catalog';
import type { Account, AccountKind } from '../../db/types';
import { centsToAmountInput } from '../../lib/amountInput';
import { parseCents, type Currency } from '../../lib/money';
import { ColorPicker } from '../../ui/Pickers';
import { Sheet, SheetDragZone } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { accountKinds } from './kinds';

interface Props {
  open: boolean;
  onClose: () => void;
  account?: Account;
  session: number;
}

export function AccountSheet({ open, onClose, account, session }: Props) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
    >
      <Form key={session} account={account} onDone={onClose} />
    </Sheet>
  );
}

function Form({ account, onDone }: { account?: Account; onDone: () => void }) {
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'cash');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'ARS');
  const [color, setColor] = useState(account?.color ?? '#4C7EA8');
  // Credit cards are entered as debt (positive) and stored as a negative balance.
  const [initial, setInitial] = useState(() =>
    account ? centsToAmountInput(Math.abs(account.initialBalanceCents)) : '',
  );
  const parsed = initial.trim() ? parseCents(initial) : 0;
  const valid = !!name.trim() && parsed !== null && parsed >= 0;

  async function save() {
    if (!valid) return;
    try {
      await saveAccount(
        {
          name,
          kind,
          currency,
          color,
          initialBalanceCents: kind === 'credit' ? -parsed : parsed,
        },
        account?.id,
      );
      onDone();
      toast(account ? 'Cuenta actualizada' : 'Cuenta creada');
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar la cuenta.');
    }
  }

  async function archive() {
    if (!account) return;
    await setArchived('accounts', account.id, 1);
    onDone();
    toast('Cuenta archivada', {
      label: 'Deshacer',
      onClick: () => void setArchived('accounts', account.id, 0),
    });
  }

  const segment =
    'min-h-10 rounded-full px-3 text-sm font-medium text-muted aria-checked:bg-raised aria-checked:text-ink aria-checked:shadow-soft';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-5 px-5 pt-1 pb-4"
    >
      <SheetDragZone>
        <h2 className="text-lg font-semibold">{account ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
      </SheetDragZone>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          autoFocus={!account}
          className="min-h-12 w-full rounded-sm bg-surface-2 px-4 text-[16px] focus-visible:outline-2 focus-visible:outline-accent-ink"
        />
      </label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-muted">Tipo</legend>
        <div
          role="radiogroup"
          aria-label="Tipo"
          className="grid grid-cols-2 gap-1 rounded-[22px] bg-surface-2 p-1"
        >
          {(Object.keys(accountKinds) as AccountKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={segment}
            >
              {accountKinds[k].label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">
            {kind === 'credit' ? 'Deuda actual' : 'Saldo inicial'}
          </span>
          <input
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-invalid={parsed === null || (parsed ?? 0) < 0}
            className="tabular min-h-12 w-full rounded-sm bg-surface-2 px-4 text-[16px] focus-visible:outline-2 focus-visible:outline-accent-ink aria-invalid:outline-2 aria-invalid:outline-expense"
          />
        </label>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-muted">Moneda</legend>
          <div role="radiogroup" aria-label="Moneda" className="flex rounded-full bg-surface-2 p-1">
            {(['ARS', 'USD'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={segment}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-muted">Color</legend>
        <ColorPicker value={color} onChange={setColor} />
      </fieldset>
      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-bg px-5 pt-2 pb-1">
        {account && (
          <button
            type="button"
            onClick={archive}
            className="flex min-h-12 items-center gap-1.5 rounded-md bg-surface-2 px-4 font-semibold text-expense"
          >
            <Archive aria-hidden className="size-4" /> Archivar
          </button>
        )}
        <button
          type="submit"
          disabled={!valid}
          className="min-h-12 flex-1 rounded-md bg-accent-ink font-semibold text-on-accent disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
