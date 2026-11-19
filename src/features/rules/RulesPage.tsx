import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, GripVertical, Plus } from 'lucide-react';
import { useDragControls } from 'motion/react';
import { Reorder } from 'motion/react-m';
import { useState } from 'react';
import { db } from '../../db/db';
import type { Rule } from '../../db/types';
import { BackLink } from '../../ui/BackLink';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { toast } from '../../ui/toast';
import { useOrder } from '../categories/useOrder';
import { useCatalog } from '../transactions/useCatalog';
import { deleteRule, matchRule, saveRule } from './rules';

/** Ajustes → Reglas: "if the note says X, use category Y". */
export function RulesPage() {
  const rules = useLiveQuery(
    () =>
      db.rules
        .orderBy('order')
        .filter((r) => !r.deleted)
        .toArray(),
    [],
  );
  const catalog = useCatalog();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [sample, setSample] = useState('');
  const byId = new Map(rules?.map((r) => [r.id, r]));
  const [ids, onReorder] = useOrder('rules', rules?.map((r) => r.id) ?? []);
  const hit = sample.trim() && rules ? matchRule(sample, rules) : undefined;

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/ajustes" />
      <h1 className="mt-2 text-[22px] font-bold">Reglas de categorías</h1>
      <p className="mt-1 text-[14.5px] leading-relaxed text-muted">
        Si la nota contiene un texto, Vuelto elige la categoría por vos al cargar. Gana la primera
        regla de la lista que coincida.
      </p>

      <label className="mt-5 grid gap-1.5">
        <span className="text-[13.5px] font-medium text-muted">Probá con un texto</span>
        <input
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          placeholder="uber al centro"
          className="well min-h-12 rounded-[14px] px-4 text-[16px] outline-none focus-visible:outline-2 focus-visible:outline-hue"
        />
      </label>
      {/* The line keeps its height while empty, so the list below never jumps. */}
      <p role="status" className="mt-2 min-h-[21px] px-1 text-[14px] text-muted">
        {!sample.trim() ? null : hit ? (
          <>
            Aplica «{hit.match}» →{' '}
            <b className="text-ink">{catalog.categories.get(hit.categoryId)?.name ?? '—'}</b>
          </>
        ) : (
          'Ninguna regla aplica.'
        )}
      </p>

      {ids.length > 0 && (
        <>
          <p id="rules-hint" className="mt-6 mb-3 text-[13.5px] text-faint">
            Arrastrá desde la manija para cambiar la prioridad. Con teclado: Enter para editar,
            Espacio para agarrar y flechas para mover.
          </p>
          <Reorder.Group
            axis="y"
            values={ids}
            onReorder={onReorder}
            className="divide-y divide-line overflow-hidden rounded-[22px] bg-flat"
            aria-describedby="rules-hint"
            aria-label="Reglas"
          >
            {ids.map((id) => {
              const r = byId.get(id);
              const c = r && catalog.categories.get(r.categoryId);
              return r ? (
                <Row
                  key={id}
                  rule={r}
                  categoryName={c?.name ?? 'Sin categoría'}
                  icon={c && <CategoryIcon icon={c.icon} color={c.color} size="sm" />}
                  onOpen={() => setEditing(r)}
                />
              ) : null;
            })}
          </Reorder.Group>
        </>
      )}

      {editing ? (
        <RuleForm
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rel mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] font-semibold"
        >
          <Plus aria-hidden className="size-4" /> Nueva regla
        </button>
      )}
    </div>
  );
}

function Row({
  rule: r,
  categoryName,
  icon,
  onOpen,
}: {
  rule: Rule;
  categoryName: string;
  icon: React.ReactNode;
  onOpen: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={r.id}
      dragListener={false}
      dragControls={controls}
      aria-label={`«${r.match}» → ${categoryName}${r.enabled ? '' : ', pausada'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen();
      }}
      className={`relative flex min-h-14 items-center bg-flat ${r.enabled ? '' : 'opacity-60'}`}
    >
      <span
        aria-hidden
        onPointerDown={(e) => controls.start(e)}
        className="grid h-14 w-11 shrink-0 cursor-grab touch-none place-items-center text-muted"
      >
        <GripVertical className="size-5" />
      </span>
      <button
        type="button"
        onClick={onOpen}
        tabIndex={-1}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 pr-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">«{r.match}»</span>
          <span className="block truncate text-[12.5px] text-muted">
            {r.enabled ? '' : 'Pausada · '}
            {r.tag ? `#${r.tag} · ` : ''}
            {categoryName}
          </span>
        </span>
        {icon}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      </button>
    </Reorder.Item>
  );
}

function RuleForm({ rule, onDone }: { rule?: Rule; onDone: () => void }) {
  const catalog = useCatalog();
  const [match, setMatch] = useState(rule?.match ?? '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [accountId, setAccountId] = useState(rule?.accountId ?? '');
  const [tag, setTag] = useState(rule?.tag ?? '');
  const [enabled, setEnabled] = useState(rule ? rule.enabled === 1 : true);
  const ok = match.trim().length > 0 && categoryId !== '';
  const categories = [...catalog.categories.values()].filter((c) => !c.deleted && !c.archived);
  const accounts = [...catalog.accounts.values()].filter(
    (a) => !a.deleted && !a.archived && !a.external,
  );
  const field =
    'well min-h-12 w-full rounded-[14px] px-4 text-[16px] outline-none focus-visible:outline-2 focus-visible:outline-hue';

  return (
    <form
      className="mt-5 grid gap-4 rounded-[22px] bg-flat p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        await saveRule({ match, categoryId, accountId, tag, enabled: enabled ? 1 : 0 }, rule?.id);
        toast(rule ? 'Regla guardada' : 'Regla creada');
        onDone();
      }}
    >
      <h2 className="text-[16px] font-semibold">{rule ? 'Editar regla' : 'Nueva regla'}</h2>
      <label className="grid gap-1.5">
        <span className="text-[13.5px] font-medium text-muted">Si la nota contiene</span>
        <input
          autoFocus
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          maxLength={40}
          placeholder="uber, coto, ypf…"
          className={field}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[13.5px] font-medium text-muted">Usar la categoría</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={field}
        >
          <option value="">Elegí una</option>
          <optgroup label="Gastos">
            {categories
              .filter((c) => c.type === 'expense')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="Ingresos">
            {categories
              .filter((c) => c.type === 'income')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[13.5px] font-medium text-muted">Y la cuenta (opcional)</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={field}
          >
            <option value="">La que elija al cargar</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[13.5px] font-medium text-muted">Y la etiqueta (opcional)</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            maxLength={24}
            placeholder="#trabajo"
            className={field}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-5 accent-[var(--color-hue)]"
        />
        Activa
      </label>
      <div className="flex gap-3">
        {rule && (
          <button
            type="button"
            onClick={async () => {
              await deleteRule(rule.id);
              toast('Regla borrada');
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
