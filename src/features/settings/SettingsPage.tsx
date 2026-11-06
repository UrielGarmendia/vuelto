import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Monitor, Moon, Repeat, Sun, Tags, Target, WalletCards } from 'lucide-react';
import { DollarSection } from './DollarSection';
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
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">{title}</h2>
      <div className="overflow-hidden rounded-[22px] bg-flat">{children}</div>
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
      <div className="grid items-start gap-6 pt-2 lg:grid-cols-2">
        <div className="grid gap-6">
          <Section title="Apariencia">
            <fieldset className="p-3">
              <legend className="sr-only">Tema</legend>
              <div className="well grid grid-cols-3 gap-1 rounded-full p-[5px]">
                {themes.map(({ value, label, icon: Icon }) => (
                  <label
                    key={value}
                    data-on={theme === value}
                    className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[14px] text-muted transition-colors has-checked:font-semibold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-hue ${theme === value ? 'rel' : ''}`}
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
                <span className="block text-[13px] text-faint">
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
                className="well relative h-8 w-[52px] shrink-0 rounded-full transition-colors peer-checked:bg-hue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hue after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-[linear-gradient(145deg,var(--color-face-a),var(--color-face-b))] after:shadow-[var(--rise)] after:transition-transform after:duration-300 after:ease-[var(--ease-spring)] peer-checked:after:translate-x-5"
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
                {
                  to: '/ajustes/presupuestos',
                  label: 'Presupuestos',
                  icon: Target,
                  count: undefined,
                },
                {
                  to: '/ajustes/recurrentes',
                  label: 'Recurrentes y favoritos',
                  icon: Repeat,
                  count: undefined,
                },
              ].map(({ to, label, icon: Icon, count }) => (
                <Link
                  key={to}
                  to={to}
                  viewTransition={viewTransitions}
                  className="hoverable flex min-h-14 items-center gap-3 px-4 active:bg-flat-2"
                >
                  <Icon aria-hidden className="size-5 text-muted" />
                  <span className="flex-1 text-[15px]">{label}</span>
                  {count !== undefined && (
                    <span className="tabular text-sm text-muted">{count}</span>
                  )}
                  <ChevronRight aria-hidden className="size-4 text-muted" />
                </Link>
              ))}
            </nav>
          </Section>
        </div>
        <div className="grid gap-6">
          <Section title="Dólar">
            <DollarSection />
          </Section>
          <Section title="Almacenamiento">
            <div className="flex min-h-14 items-center justify-between gap-4 px-4">
              <span className="text-[15px]">Datos protegidos</span>
              <span
                className={`text-sm font-medium ${persisted?.value ? 'text-positive' : 'text-muted'}`}
              >
                {persisted === undefined
                  ? '…'
                  : persisted.value
                    ? 'Sí, persistente'
                    : 'No garantizado'}
              </span>
            </div>
          </Section>

          <Section title="Backup">
            <BackupSection />
          </Section>
        </div>
      </div>
    </>
  );
}
