import { Plus, Search } from 'lucide-react';
import { useTxSheet } from '../features/transactions/store';
import { Wordmark } from '../ui/Wordmark';
import { useOpenSearch } from './nav';

export function TopBar() {
  const openNew = useTxSheet((s) => s.openNew);
  const openSearch = useOpenSearch();
  return (
    <div className="flex h-15 items-center justify-between gap-4 lg:h-16 lg:border-b lg:border-line">
      <Wordmark className="lg:hidden" />
      <button
        type="button"
        onClick={openSearch}
        className="well hidden h-10 w-full max-w-[440px] items-center gap-2 rounded-full px-4 text-left text-[14px] text-faint lg:flex"
      >
        <Search aria-hidden className="size-4" /> Buscar movimientos
        <kbd className="ml-auto font-sans text-[12px]">/</kbd>
      </button>
      <button
        type="button"
        onClick={openSearch}
        aria-label="Buscar movimientos"
        className="-mr-2 grid size-11 place-items-center rounded-full text-muted lg:hidden"
      >
        <Search aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        onClick={openNew}
        className="rel go hidden min-h-[42px] items-center gap-1.5 rounded-full px-[18px] text-[14px] font-bold lg:inline-flex"
      >
        <Plus aria-hidden className="size-[17px]" strokeWidth={2.4} /> Cargar
      </button>
    </div>
  );
}
