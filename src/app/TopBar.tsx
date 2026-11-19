import { CloudOff, Eye, EyeOff, Plus, Search, Sparkles } from 'lucide-react';
import { usePrefs } from './prefs';
import { useCopilot } from '../features/copilot/store';
import { useSync } from '../features/sync/useSync';
import { useTxSheet } from '../features/transactions/store';
import { Wordmark } from '../ui/Wordmark';
import { useSearch } from './nav';

export function TopBar() {
  const openNew = useTxSheet((s) => s.openNew);
  const openCopilot = useCopilot((s) => s.openCopilot);
  const openSearch = () => useSearch.getState().set(true);
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
      <Reconnect />
      <span className="-mr-2 flex items-center lg:hidden">
        <PrivacyToggle />
        <button
          type="button"
          onClick={openCopilot}
          aria-label="Copiloto de carga"
          className="grid size-11 place-items-center rounded-full text-hue"
        >
          <Sparkles aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          onClick={openSearch}
          aria-label="Buscar"
          className="grid size-11 place-items-center rounded-full text-muted"
        >
          <Search aria-hidden className="size-5" />
        </button>
      </span>
      <span className="hidden lg:ml-auto lg:block">
        <PrivacyToggle />
      </span>
      <button
        type="button"
        onClick={openCopilot}
        className="rel hidden min-h-[42px] items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold lg:inline-flex"
      >
        <Sparkles aria-hidden className="size-4 text-hue" /> Copiloto
      </button>
      <button
        type="button"
        onClick={openNew}
        aria-label="Cargar movimiento"
        className="rel go hidden min-h-[42px] items-center gap-1.5 rounded-full px-[18px] text-[14px] font-bold lg:inline-flex"
      >
        <Plus aria-hidden className="size-[17px]" strokeWidth={2.4} /> Cargar
      </button>
    </div>
  );
}

/** Discreet: only when the Google session expired and a tap is needed to renew it. */
function Reconnect() {
  const status = useSync((s) => s.status);
  const reconnect = useSync((s) => s.reconnect);
  if (status !== 'reconnect') return null;
  return (
    <button
      type="button"
      onClick={() => void reconnect().catch(() => undefined)}
      className="ml-auto flex min-h-9 items-center gap-1.5 rounded-full bg-flat px-3 text-[12.5px] font-medium text-muted"
    >
      <CloudOff aria-hidden className="size-3.5 text-over" /> Reconectar con Google
    </button>
  );
}

/** Hides every amount in the app (or shows them again); remembered between sessions. */
function PrivacyToggle() {
  const hidden = usePrefs((s) => s.privateMode);
  const toggle = usePrefs((s) => s.togglePrivateMode);
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
      title={hidden ? 'Mostrar montos (H)' : 'Ocultar montos (H)'}
      className={`grid size-11 shrink-0 place-items-center rounded-full ${
        hidden ? 'text-hue' : 'text-muted'
      }`}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
