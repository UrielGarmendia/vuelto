import { ChevronDown, Search, X } from 'lucide-react';
import type { Account, Category } from '../../db/types';
import { isFiltering, useFilters, type Range } from './filters';

const ranges: { value: Range; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'month', label: 'Este mes' },
  { value: 'last-month', label: 'Mes pasado' },
  { value: '30d', label: 'Últimos 30 días' },
];

function Chip({
  label,
  active,
  value,
  onChange,
  options,
}: {
  label: string;
  active: boolean;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((o) => o.value === value)?.label ?? label;
  return (
    <label
      className={`relative flex min-h-10 shrink-0 items-center gap-1 rounded-full pr-2.5 pl-3.5 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent-ink ${
        active ? 'bg-ink text-bg' : 'bg-surface-2 text-ink'
      }`}
    >
      {active ? current : label}
      <ChevronDown aria-hidden className="size-4 opacity-60" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({
  categories,
  accounts,
}: {
  categories: Category[];
  accounts: Account[];
}) {
  const f = useFilters();
  const active = isFiltering(f);

  return (
    <div className="space-y-2 pb-1">
      <div className="px-5">
        <label className="flex min-h-11 items-center gap-2 rounded-sm bg-surface-2 px-3 has-focus-visible:outline-2 has-focus-visible:outline-accent-ink">
          <Search aria-hidden className="size-4 shrink-0 text-muted" />
          <input
            type="search"
            value={f.query}
            onChange={(e) => f.set({ query: e.target.value })}
            placeholder="Buscar por nota, categoría o monto"
            aria-label="Buscar movimientos"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
          />
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none]">
        <Chip
          label="Fecha"
          active={f.range !== 'all'}
          value={f.range}
          onChange={(v) => f.set({ range: v as Range })}
          options={ranges}
        />
        <Chip
          label="Tipo"
          active={!!f.type}
          value={f.type ?? ''}
          onChange={(v) => f.set({ type: (v || undefined) as 'expense' | 'income' | undefined })}
          options={[
            { value: '', label: 'Todos' },
            { value: 'expense', label: 'Gastos' },
            { value: 'income', label: 'Ingresos' },
          ]}
        />
        <Chip
          label="Categoría"
          active={!!f.categoryId}
          value={f.categoryId ?? ''}
          onChange={(v) => f.set({ categoryId: v || undefined })}
          options={[
            { value: '', label: 'Todas' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Chip
          label="Cuenta"
          active={!!f.accountId}
          value={f.accountId ?? ''}
          onChange={(v) => f.set({ accountId: v || undefined })}
          options={[
            { value: '', label: 'Todas' },
            ...accounts.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        {active && (
          <button
            type="button"
            onClick={f.reset}
            className="flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-accent-ink"
          >
            <X aria-hidden className="size-4" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
