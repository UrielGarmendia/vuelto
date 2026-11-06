import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Monitor, Moon, Sun, Tags, WalletCards } from 'lucide-react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { db } from '../../db/db';
import { usePrefs, type Theme } from '../../app/prefs';
import { PageHeader } from '../../ui/PageHeader';
import { BackupSection } from './BackupSection';
import { viewTransitions } from '../../app/viewTransitions';

const themes: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pt-6">
      <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
      </h2>
      <div className="rounded-md bg-surface shadow-soft">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { theme, setTheme, reduceMotion, setReduceMotion } = usePrefs();
  const persisted = useLiveQuery(() => db.kv.get('storagePersisted'));
  const counts = useLiveQuery(async () => ({
    categories: await db.categories.filter((c) => !c.deleted && !c.archived).count(),
    accounts: await db.accounts.filter((a) => !a.deleted && !a.archived).count(),
  }));

  return (
    <>
      <PageHeader title="Ajustes" />

      <Section title="Apariencia">
        <fieldset className="p-2">
          <legend className="sr-only">Tema</legend>
          <div className="grid grid-cols-3 gap-1 rounded-sm bg-surface-2 p-1">
            {themes.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] text-sm font-medium text-muted transition-colors has-checked:bg-raised has-checked:text-ink has-checked:shadow-soft has-focus-visible:outline-2 has-focus-visible:outline-accent-ink"
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                  className="sr-only"
                />
                <Icon aria-hidden className="size-4" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 border-t border-line px-4 py-3">
          <span>
            <span className="block text-[15px]">Reducir animaciones</span>
            <span className="block text-xs text-muted">
              Reemplaza movimientos por fundidos cortos
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
          />
        </label>
      </Section>

      <Section title="Tus datos">
        <nav aria-label="Datos" className="divide-y divide-line">
          {[
            {
              to: '/ajustes/categorias',
              label: 'Categorías',
              icon: Tags,
              count: counts?.categories,
            },
            {
              to: '/ajustes/cuentas',
              label: 'Cuentas',
              icon: WalletCards,
              count: counts?.accounts,
            },
          ].map(({ to, label, icon: Icon, count }) => (
            <Link
              key={to}
              to={to}
              viewTransition={viewTransitions}
              className="flex min-h-14 items-center gap-3 px-4 active:bg-surface-2"
            >
              <Icon aria-hidden className="size-5 text-muted" />
              <span className="flex-1 text-[15px]">{label}</span>
              {count !== undefined && <span className="tabular text-sm text-muted">{count}</span>}
              <ChevronRight aria-hidden className="size-4 text-muted" />
            </Link>
          ))}
        </nav>
      </Section>

      <Section title="Almacenamiento">
        <div className="flex min-h-14 items-center justify-between gap-4 px-4">
          <span className="text-[15px]">Datos protegidos</span>
          <span
            className={`text-sm font-medium ${persisted?.value ? 'text-income' : 'text-muted'}`}
          >
            {persisted === undefined ? '…' : persisted.value ? 'Sí, persistente' : 'No garantizado'}
          </span>
        </div>
      </Section>

      <Section title="Backup">
        <BackupSection />
      </Section>
    </>
  );
}
