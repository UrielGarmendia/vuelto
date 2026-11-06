import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
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
      data-on={active}
      className={`rel relative flex min-h-[38px] shrink-0 items-center gap-1 rounded-full pr-2.5 pl-3.5 text-[13.5px] has-focus-visible:outline-2 has-focus-visible:outline-hue ${
        active ? 'font-semibold text-ink' : 'text-muted'
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
  const search = useRef<HTMLInputElement>(null);
  const focusSearch = (useLocation().state as { focusSearch?: number } | null)?.focusSearch;
  // The `/` shortcut and the search buttons land here with the box focused.
  useEffect(() => {
    if (focusSearch) search.current?.focus();
  }, [focusSearch]);

  return (
    <div className="space-y-2.5 pb-1">
      <div>
        <label className="well flex min-h-[46px] items-center gap-2 rounded-full px-4 has-focus-visible:outline-2 has-focus-visible:outline-hue">
          <Search aria-hidden className="size-[17px] shrink-0 text-faint" />
          <input
            ref={search}
            type="search"
            value={f.query}
            onChange={(e) => f.set({ query: e.target.value })}
            placeholder="Buscar por nota, categoría o monto"
            aria-label="Buscar movimientos"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
          />
        </label>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 md:mx-0 md:px-0.5">
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
            className="flex min-h-[38px] shrink-0 items-center gap-1 rounded-full px-3 text-[13.5px] font-medium text-hue"
          >
            <X aria-hidden className="size-4" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
