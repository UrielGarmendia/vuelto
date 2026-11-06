import { useLiveQuery } from 'dexie-react-hooks';
import { Star, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import type { Recurring, Template } from '../../db/types';
import { formatShortDay } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { BackLink } from '../../ui/BackLink';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { toast } from '../../ui/toast';
import { useCatalog } from './useCatalog';

const every: Record<Recurring['frequency'], string> = {
  weekly: 'cada semana',
  monthly: 'cada mes',
  yearly: 'cada año',
};

/** Repeating movements (pause or stop them) and one-tap favorites (remove them). */
export function RepeatsPage() {
  const rules = useLiveQuery(() => db.recurring.filter((r) => !r.deleted).toArray(), []);
  const templates = useLiveQuery(
    () =>
      db.templates
        .orderBy('order')
        .filter((t) => !t.deleted)
        .toArray(),
    [],
  );
  const catalog = useCatalog();

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/ajustes" label="Ajustes" />
      <h1 className="mt-2 text-[22px] font-bold">Recurrentes y favoritos</h1>

      <section aria-labelledby="rules-label" className="mt-5">
        <h2 id="rules-label" className="mb-2 px-1 text-[13px] font-semibold text-muted">
          Se cargan solos
        </h2>
        {rules && rules.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-flat">
            {rules.map((r) => {
              const cat = r.template.categoryId
                ? catalog.categories.get(r.template.categoryId)
                : undefined;
              const name = r.template.note || cat?.name || 'Movimiento';
              return (
                <li key={r.id} className="flex min-h-[66px] items-center gap-3 px-4 py-2.5">
                  <CategoryIcon
                    icon={r.template.type === 'transfer' ? 'arrow-left-right' : cat?.icon}
                    color={cat?.color ?? '#8d9096'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{name}</span>
                    <span className="block truncate text-[13px] text-faint">
                      {formatMoney(r.template.amountCents ?? 0, r.template.currency)}{' '}
                      {every[r.frequency]} ·{' '}
                      {r.active ? `próximo ${formatShortDay(r.nextDate)}` : 'en pausa'}
                    </span>
                  </span>
                  <label className="relative flex min-h-11 items-center">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={!!r.active}
                      aria-label={`${name}: ${r.active ? 'activo' : 'en pausa'}`}
                      onChange={(e) =>
                        void db.recurring.update(r.id, {
                          active: e.target.checked ? 1 : 0,
                          updatedAt: Date.now(),
                          synced: 0,
                        })
                      }
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className="well relative h-8 w-[52px] shrink-0 rounded-full transition-colors peer-checked:bg-hue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hue after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-[linear-gradient(145deg,var(--color-face-a),var(--color-face-b))] after:shadow-[var(--rise)] after:transition-transform after:duration-300 peer-checked:after:translate-x-5"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Dejar de repetir ${name}`}
                    onClick={async () => {
                      await db.recurring.update(r.id, {
                        deleted: 1,
                        updatedAt: Date.now(),
                        synced: 0,
                      });
                      toast('Ya no se repite. Lo cargado hasta hoy queda.', {
                        label: 'Deshacer',
                        onClick: () =>
                          void db.recurring.update(r.id, {
                            deleted: 0,
                            updatedAt: Date.now(),
                            synced: 0,
                          }),
                      });
                    }}
                    className="grid size-11 place-items-center rounded-full text-faint hover:text-negative"
                  >
                    <Trash2 aria-hidden className="size-[18px]" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[22px] bg-flat px-5 py-4 text-[14px] leading-relaxed text-muted">
            Al cargar un movimiento, elegí “Repetir” (cada semana, mes o año) y Vuelto lo carga solo
            cada vez que abras la app.
          </p>
        )}
      </section>

      <section aria-labelledby="fav-label" className="mt-7">
        <h2 id="fav-label" className="mb-2 px-1 text-[13px] font-semibold text-muted">
          Favoritos
        </h2>
        {templates && templates.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-flat">
            {templates.map((t) => (
              <TemplateRow key={t.id} template={t} />
            ))}
          </ul>
        ) : (
          <p className="rounded-[22px] bg-flat px-5 py-4 text-[14px] leading-relaxed text-muted">
            Marcá “Favorito” al cargar un movimiento y aparece arriba del teclado para cargarlo con
            un toque.
          </p>
        )}
      </section>
    </div>
  );
}

function TemplateRow({ template: t }: { template: Template }) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4">
      <Star aria-hidden className="size-4 shrink-0 fill-current text-over" />
      <span className="min-w-0 flex-1 truncate text-[15px]">{t.name}</span>
      {t.amountCents ? (
        <span className="tabular text-[14px] text-muted">{formatMoney(t.amountCents)}</span>
      ) : null}
      <button
        type="button"
        aria-label={`Quitar ${t.name} de favoritos`}
        onClick={() =>
          void db.templates.update(t.id, { deleted: 1, updatedAt: Date.now(), synced: 0 })
        }
        className="grid size-11 place-items-center rounded-full text-faint hover:text-negative"
      >
        <Trash2 aria-hidden className="size-[18px]" />
      </button>
    </li>
  );
}
