import { useLiveQuery } from 'dexie-react-hooks';
import { Mic, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { usePrefs } from '../../app/prefs';
import { db } from '../../db/db';
import type { Account, Category, Rule, TxType } from '../../db/types';
import { todayISO } from '../../lib/dates';
import { amountInputToCents } from '../../lib/amountInput';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { useOnline } from '../../ui/useOnline';
import { useRates } from '../currency/rates';
import { plain, ruleKeyword, saveRule } from '../rules/rules';
import { createTransaction } from '../transactions/create';
import { useLastUsed } from '../transactions/store';
import { problems, toCard, type Card } from './cards';
import { parseMessage } from './parse';
import { useCopilot } from './store';

const typeNames: Record<TxType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
};

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}
type SpeechCtor = new () => SpeechRecognitionLike;
const Speech =
  (globalThis as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor })
    .SpeechRecognition ??
  (globalThis as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition;

/** "Contale a Vuelto": write or say movements, review them as cards, save them all. */
export function CopilotSheet() {
  const { open, session, close } = useCopilot();
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
        .filter((a) => !a.archived && !a.deleted && !a.external)
        .toArray(),
    [],
  );
  const rules = useLiveQuery(() => db.rules.filter((r) => !r.deleted).toArray(), []);
  const ready = !!categories && !!accounts && !!rules;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title="Copiloto de carga">
      {ready && (
        <Copilot
          key={session}
          categories={categories}
          accounts={accounts}
          rules={rules}
          onDone={close}
        />
      )}
    </Sheet>
  );
}

function Copilot({
  categories,
  accounts,
  rules,
  onDone,
}: {
  categories: Category[];
  accounts: Account[];
  rules: Rule[];
  onDone: () => void;
}) {
  const lastAccount = useLastUsed((s) => s.accountId);
  const rateKind = usePrefs((s) => s.rateKind);
  const rate = useRates()?.values[rateKind];
  const online = useOnline();
  const [text, setText] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [listening, setListening] = useState<SpeechRecognitionLike | null>(null);
  const [saving, setSaving] = useState(false);

  const read = () => {
    const drafts = parseMessage(text, {
      categories,
      accounts,
      rules,
      today: todayISO(),
      defaultAccountId: lastAccount,
    });
    setCards((c) => [...c, ...drafts.map(toCard)]);
    setText('');
  };

  const listen = () => {
    if (listening) return listening.stop();
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = 'es-AR';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? '';
      setText((t) => (t.trim() ? `${t.trim()}\n${said}` : said));
    };
    rec.onend = () => setListening(null);
    rec.onerror = () => {
      setListening(null);
      toast('No te pude escuchar. Probá de nuevo o escribilo.');
    };
    rec.start();
    setListening(rec);
  };

  const update = (key: string, patch: Partial<Card>) =>
    setCards((all) => all.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const valid = (c: Card) => problems(c, accounts).length === 0;
  const allValid = cards.length > 0 && cards.every(valid);

  async function saveAll() {
    if (!allValid) return;
    setSaving(true);
    try {
      for (const c of cards) {
        const account = accounts.find((a) => a.id === c.accountId)!;
        const receiptBlobId = c.photo ? crypto.randomUUID() : undefined;
        if (c.photo && receiptBlobId) await db.blobs.add({ id: receiptBlobId, blob: c.photo });
        const tagged =
          c.tag && !c.note.includes(`#${c.tag}`) ? `${c.note} #${c.tag}`.trim() : c.note;
        await createTransaction(
          {
            type: c.type,
            amountCents: amountInputToCents(c.amount),
            currency: account.currency,
            rateAtDate: account.currency === 'USD' ? rate : undefined,
            date: c.date,
            categoryId: c.type === 'transfer' ? undefined : c.categoryId,
            accountId: account.id,
            toAccountId: c.type === 'transfer' ? c.toAccountId : undefined,
            note: tagged,
            receiptBlobId,
          },
          {
            installments:
              c.type === 'expense' && account.kind === 'credit' ? (c.installments ?? 1) : 1,
          },
        );
      }
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar. Probá de nuevo.');
      setSaving(false);
      return;
    }
    onDone();
    toast(cards.length === 1 ? 'Movimiento guardado' : `${cards.length} movimientos guardados`);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div>
        <h2 className="flex items-center gap-2 text-[18px] font-bold">
          <Sparkles aria-hidden className="size-5 text-hue" /> Contale a Vuelto
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
          Escribí como hablás: «super 23 lucas con mp», «ayer birra 12k en efectivo». Todo se lee en
          tu dispositivo y nada se guarda hasta que lo confirmes.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) read();
        }}
        className="grid gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
              e.preventDefault();
              read();
            }
          }}
          rows={3}
          maxLength={500}
          aria-label="¿Qué gastaste o cobraste?"
          placeholder="nafta 35 lucas y sube 2 lucas"
          className="well w-full resize-none rounded-[18px] px-4 py-3 text-[16px] leading-relaxed placeholder:text-faint focus-visible:outline-2 focus-visible:outline-hue"
        />
        <div className="flex items-center gap-2">
          {Speech && (
            <button
              type="button"
              onClick={listen}
              aria-pressed={!!listening}
              aria-label={listening ? 'Dejar de escuchar' : 'Dictar'}
              className={`rel grid size-12 shrink-0 place-items-center rounded-full ${
                listening ? 'text-over' : 'text-muted'
              }`}
            >
              <Mic aria-hidden className={`size-5 ${listening ? 'animate-pulse' : ''}`} />
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            className="rel go ml-auto min-h-12 rounded-[16px] px-6 text-[15px] font-bold disabled:opacity-50"
          >
            Leer
          </button>
        </div>
        {listening && (
          <p role="status" className="text-[13px] text-muted">
            Escuchando… hablá y después tocá «Leer».
          </p>
        )}
      </form>

      {cards.length > 0 && (
        <section aria-label="Movimientos para revisar" className="grid grid-cols-1 gap-3">
          {cards.map((c) => (
            <CardEditor
              key={c.key}
              card={c}
              categories={categories}
              accounts={accounts}
              rules={rules}
              onChange={(patch) => update(c.key, patch)}
              onDiscard={() => setCards((all) => all.filter((x) => x.key !== c.key))}
            />
          ))}
          <button
            type="button"
            disabled={!allValid || saving}
            onClick={() => void saveAll()}
            className="rel go min-h-[52px] rounded-[18px] text-[16px] font-bold disabled:opacity-50"
          >
            {cards.length === 1 ? 'Guardar' : `Guardar todo (${cards.length})`}
          </button>
          {!allValid && (
            <p className="text-center text-[13px] text-muted">
              Completá lo marcado en ámbar para guardar.
            </p>
          )}
          {!online && (
            <p className="text-center text-[12.5px] text-faint">
              Sin conexión: el copiloto lee igual, todo pasa en tu dispositivo.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function CardEditor({
  card: c,
  categories,
  accounts,
  rules,
  onChange,
  onDiscard,
}: {
  card: Card;
  categories: Category[];
  accounts: Account[];
  rules: Rule[];
  onChange: (patch: Partial<Card>) => void;
  onDiscard: () => void;
}) {
  const [learned, setLearned] = useState(false);
  const todo = problems(c, accounts);
  const doubtful = todo.length > 0 || c.confidence < 0.7;
  const account = accounts.find((a) => a.id === c.accountId);
  const symbol = (account?.currency ?? c.currency) === 'USD' ? 'US$' : '$';
  const field =
    'well min-h-11 w-full min-w-0 rounded-[12px] px-3 text-[15px] focus-visible:outline-2 focus-visible:outline-hue';
  const category = categories.find((x) => x.id === c.categoryId);
  const keyword = ruleKeyword(c.note || c.source);
  // A corrected category can become a rule, so the next reading gets it right.
  const offerRule =
    !learned &&
    c.type !== 'transfer' &&
    category &&
    c.categoryId !== c.proposedCategoryId &&
    keyword &&
    !rules.some((r) => plain(r.match) === keyword);

  return (
    <article
      aria-label={`${typeNames[c.type]}${c.note ? `: ${c.note}` : ''}`}
      className={`min-w-0 rounded-[22px] border-2 bg-flat p-4 ${doubtful ? 'border-over' : 'border-transparent'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-faint">«{c.source}»</p>
        {doubtful && (
          <span className="shrink-0 rounded-full bg-sunk px-2 py-0.5 text-[11.5px] font-semibold text-over">
            Revisá
          </span>
        )}
        <button
          type="button"
          onClick={onDiscard}
          aria-label="Descartar"
          className="-mt-2 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label="Tipo"
        className="well mt-2 grid grid-cols-3 gap-1 rounded-full p-1"
      >
        {(['expense', 'income', 'transfer'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={c.type === t}
            onClick={() =>
              onChange({ type: t, categoryId: t === c.type ? c.categoryId : undefined })
            }
            className={`min-h-9 rounded-full text-[13px] ${c.type === t ? 'rel font-semibold' : 'text-muted'}`}
          >
            {typeNames[t]}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="col-span-2 grid gap-1">
          <span className="text-[12.5px] text-muted">Monto</span>
          <span className={`${field} flex items-center gap-1.5`}>
            <span className="text-muted">{symbol}</span>
            <input
              inputMode="decimal"
              value={c.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              aria-label="Monto"
              className="tabular min-w-0 flex-1 bg-transparent text-[17px] font-semibold outline-none"
            />
          </span>
        </label>
        {c.type === 'transfer' ? null : (
          <label className="col-span-2 grid gap-1">
            <span
              className={`text-[12.5px] ${c.categoryId ? 'text-muted' : 'font-semibold text-over'}`}
            >
              Categoría
            </span>
            <select
              value={c.categoryId ?? ''}
              onChange={(e) => onChange({ categoryId: e.target.value || undefined })}
              aria-label="Categoría"
              className={field}
            >
              <option value="">Elegí una</option>
              {categories
                .filter((x) => x.type === c.type)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="grid gap-1">
          <span className="text-[12.5px] text-muted">
            {c.type === 'transfer' ? 'Desde' : 'Cuenta'}
          </span>
          <select
            value={c.accountId ?? ''}
            onChange={(e) => {
              const a = accounts.find((x) => x.id === e.target.value);
              onChange({ accountId: a?.id, currency: a?.currency ?? c.currency });
            }}
            aria-label={c.type === 'transfer' ? 'Desde' : 'Cuenta'}
            className={field}
          >
            <option value="">Elegí una</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.currency !== 'ARS' ? ` (${a.currency})` : ''}
              </option>
            ))}
          </select>
        </label>
        {c.type === 'transfer' ? (
          <label className="grid gap-1">
            <span className="text-[12.5px] text-muted">Hacia</span>
            <select
              value={c.toAccountId ?? ''}
              onChange={(e) => onChange({ toAccountId: e.target.value || undefined })}
              aria-label="Hacia"
              className={field}
            >
              <option value="">Elegí una</option>
              {accounts
                .filter((a) => a.id !== c.accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <label className="grid gap-1">
            <span className="text-[12.5px] text-muted">Fecha</span>
            <input
              type="date"
              value={c.date}
              max={todayISO()}
              onChange={(e) => e.target.value && onChange({ date: e.target.value })}
              aria-label="Fecha"
              className={field}
            />
          </label>
        )}
        {c.type === 'expense' && account?.kind === 'credit' && (
          <label className="grid gap-1">
            <span className="text-[12.5px] text-muted">Cuotas</span>
            <select
              value={c.installments ?? 1}
              onChange={(e) => onChange({ installments: Number(e.target.value) })}
              aria-label="Cuotas"
              className={field}
            >
              {[1, 2, 3, 6, 9, 12, 18, 24].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'Sin cuotas' : `${n} cuotas`}
                </option>
              ))}
            </select>
          </label>
        )}
        <label
          className={`grid gap-1 ${c.type === 'expense' && account?.kind === 'credit' ? '' : 'col-span-2'}`}
        >
          <span className="text-[12.5px] text-muted">Nota</span>
          <input
            value={c.note}
            onChange={(e) => onChange({ note: e.target.value })}
            maxLength={140}
            aria-label="Nota"
            className={field}
          />
        </label>
      </div>

      {todo.length > 0 && <p className="mt-3 text-[13px] text-over">Falta {todo.join(', ')}.</p>}
      {offerRule && (
        <button
          type="button"
          onClick={() =>
            void saveRule({ match: keyword, categoryId: category.id }).then(() => {
              setLearned(true);
              toast(`Regla creada: «${keyword}» → ${category.name}`);
            })
          }
          className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-[14px] bg-flat-2 px-3 text-left text-[13.5px] font-medium"
        >
          <WandSparkles aria-hidden className="size-4 shrink-0 text-hue" />
          ¿Usar siempre {category.name} para «{keyword}»?
        </button>
      )}
    </article>
  );
}
