import * as Dialog from '@radix-ui/react-dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { CornerDownLeft, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDay, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { CategoryIcon } from '../ui/CategoryIcon';
import { emptyFilters, filterTransactions, useFilters } from '../features/transactions/filters';
import { listTransactions } from '../features/transactions/queries';
import { useCatalog } from '../features/transactions/useCatalog';
import { useSearch } from './nav';
import { viewTransitions } from './viewTransitions';

const pages = [
  { label: 'Inicio', to: '/' },
  { label: 'Movimientos', to: '/movimientos' },
  { label: 'Estadísticas', to: '/estadisticas' },
  { label: 'Ajustes', to: '/ajustes' },
  { label: 'Presupuestos', to: '/ajustes/presupuestos' },
  { label: 'Categorías', to: '/ajustes/categorias' },
  { label: 'Cuentas', to: '/ajustes/cuentas' },
  { label: 'Recurrentes y favoritos', to: '/ajustes/recurrentes' },
  { label: 'Metas de ahorro', to: '/ajustes/metas' },
  { label: 'Privacidad', to: '/privacidad' },
];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

interface Item {
  key: string;
  group: string;
  label: string;
  detail?: string;
  icon?: { icon?: string; color?: string };
  run: () => void;
}

/** One box to find movements, categories and screens (Ctrl+K, / or the search button). */
export function SearchPalette() {
  const open = useSearch((s) => s.open);
  const setOpen = useSearch((s) => s.set);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--scrim)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[min(640px,80dvh)] max-w-[560px] flex-col overflow-hidden rounded-[24px] border border-line bg-ground outline-none sm:top-[10dvh]"
        >
          <Dialog.Title className="sr-only">Buscar</Dialog.Title>
          {open && <Palette onDone={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Palette({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const txs = useLiveQuery(() => listTransactions(), []);
  const catalog = useCatalog();
  const filters = useFilters();
  const go = (to: string) => {
    onDone();
    navigate(to, { viewTransition: viewTransitions });
  };

  const items = ((): Item[] => {
    const q = fold(query.trim());
    if (!q)
      return pages
        .slice(0, 4)
        .map((p) => ({ key: p.to, group: 'Ir a', label: p.label, run: () => go(p.to) }));
    const out: Item[] = [];
    for (const p of pages)
      if (fold(p.label).includes(q))
        out.push({ key: p.to, group: 'Ir a', label: p.label, run: () => go(p.to) });
    for (const c of catalog.categories.values()) {
      if (c.deleted || !fold(c.name).includes(q)) continue;
      out.push({
        key: c.id,
        group: 'Categorías',
        label: c.name,
        detail: 'Ver sus movimientos',
        icon: c,
        run: () => {
          filters.reset();
          filters.set({ categoryId: c.id });
          go('/movimientos');
        },
      });
    }
    const found = txs
      ? filterTransactions(txs, { ...emptyFilters, query }, catalog.categories, todayISO())
      : [];
    for (const t of found.slice(0, 30)) {
      const cat = t.categoryId ? catalog.categories.get(t.categoryId) : undefined;
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
      out.push({
        key: t.id,
        group: 'Movimientos',
        label: t.note || cat?.name || 'Transferencia',
        detail: `${formatDay(t.date)} · ${sign}${formatMoney(t.amountCents, t.currency)}`,
        icon: t.type === 'transfer' ? { icon: 'arrow-left-right', color: '#8d9096' } : cat,
        run: () => go(`/movimientos/${t.id}`),
      });
    }
    return out;
  })();

  const current = Math.min(active, items.length - 1);

  return (
    <>
      <label className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <Search aria-hidden className="size-5 text-faint" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && items[current]) {
              e.preventDefault();
              items[current].run();
            }
          }}
          placeholder="Buscá un gasto, una categoría o una pantalla"
          aria-label="Buscar en Vuelto"
          aria-controls="search-results"
          aria-activedescendant={items[current] ? `sr-${items[current].key}` : undefined}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
        />
        <kbd className="hidden font-sans text-[12px] text-faint sm:block">Esc</kbd>
      </label>
      <ul
        id="search-results"
        role="listbox"
        aria-label="Resultados"
        className="overflow-y-auto p-2"
      >
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-[14px] text-muted">
            Nada con “{query.trim()}”.
          </li>
        )}
        {items.map((it, i) => (
          <li key={it.key} role="presentation">
            {(i === 0 || items[i - 1]!.group !== it.group) && (
              <p className="px-3 pt-3 pb-1 text-[12px] font-semibold text-faint">{it.group}</p>
            )}
            <button
              id={`sr-${it.key}`}
              type="button"
              role="option"
              aria-selected={i === current}
              onMouseMove={() => setActive(i)}
              onClick={it.run}
              className="flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3 text-left aria-selected:bg-flat"
            >
              {it.icon && <CategoryIcon icon={it.icon.icon} color={it.icon.color} size="sm" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{it.label}</span>
                {it.detail && (
                  <span className="block truncate text-[12.5px] text-faint">{it.detail}</span>
                )}
              </span>
              {i === current && <CornerDownLeft aria-hidden className="size-4 text-faint" />}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
