import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, GripVertical, Plus } from 'lucide-react';
import { useDragControls } from 'motion/react';
import { Reorder } from 'motion/react-m';
import { useState } from 'react';
import { setArchived } from '../../db/catalog';
import { db } from '../../db/db';
import type { Category } from '../../db/types';
import { BackLink } from '../../ui/BackLink';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { CategorySheet } from './CategorySheet';
import { useOrder } from './useOrder';

type Kind = 'expense' | 'income';

export function CategoriesPage() {
  const [type, setType] = useState<Kind>('expense');
  const [sheet, setSheet] = useState<{ open: boolean; category?: Category; session: number }>({
    open: false,
    session: 0,
  });
  const all = useLiveQuery(
    () =>
      db.categories
        .orderBy('order')
        .filter((c) => !c.deleted)
        .toArray(),
    [],
  );
  const active = all?.filter((c) => c.type === type && !c.archived) ?? [];
  const archived = all?.filter((c) => c.type === type && c.archived) ?? [];
  const byId = new Map(active.map((c) => [c.id, c]));
  const [ids, onReorder] = useOrder(
    'categories',
    active.map((c) => c.id),
  );

  const open = (category?: Category) =>
    setSheet((s) => ({ open: true, category, session: s.session + 1 }));

  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/ajustes" label="Ajustes" />
      <h1 className="mt-2 text-[22px] font-bold">Categorías</h1>

      <div
        role="radiogroup"
        aria-label="Tipo de categoría"
        className="well mt-4 grid max-w-xs grid-cols-2 gap-1 rounded-full p-[5px]"
      >
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={type === k}
            onClick={() => setType(k)}
            className={`min-h-9 rounded-full text-[14px] text-muted aria-checked:font-semibold aria-checked:text-ink ${type === k ? 'rel' : ''}`}
          >
            {k === 'expense' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>

      <p id="reorder-hint" className="mt-4 mb-3 text-[13.5px] text-faint">
        Arrastrá desde la manija para reordenar. Con teclado: Enter para editar, Espacio para
        agarrar y flechas para mover.
      </p>
      <Reorder.Group
        axis="y"
        values={ids}
        onReorder={onReorder}
        className="divide-y divide-line overflow-hidden rounded-[22px] bg-flat"
        aria-describedby="reorder-hint"
      >
        {ids.map((id) => {
          const c = byId.get(id);
          return c ? <Row key={id} category={c} onOpen={() => open(c)} /> : null;
        })}
      </Reorder.Group>

      <button
        type="button"
        onClick={() => open()}
        className="rel mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] font-semibold"
      >
        <Plus aria-hidden className="size-4" /> Nueva categoría
      </button>

      {archived.length > 0 && (
        <section aria-labelledby="archived-label" className="mt-8">
          <h2 id="archived-label" className="mb-2 px-1 text-[13px] font-semibold text-muted">
            Archivadas
          </h2>
          <ul className="divide-y divide-line rounded-[22px] bg-flat">
            {archived.map((c) => (
              <li key={c.id} className="flex min-h-14 items-center gap-3 px-4 opacity-70">
                <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                <span className="flex-1 truncate">{c.name}</span>
                <button
                  type="button"
                  onClick={() => void setArchived('categories', c.id, 0)}
                  className="min-h-11 rounded-sm px-3 text-sm font-semibold text-hue"
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CategorySheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        category={sheet.category}
        type={type}
        session={sheet.session}
      />
    </div>
  );
}

function Row({ category: c, onOpen }: { category: Category; onOpen: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={c.id}
      dragListener={false}
      dragControls={controls}
      aria-label={c.name}
      // Reorder owns focus (Space/arrows); Enter opens the editor.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen();
      }}
      className="relative flex min-h-14 items-center bg-flat"
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
        className="flex min-h-14 flex-1 items-center gap-3 pr-3 text-left"
      >
        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
        <span className="flex-1 truncate text-[15px] font-medium">{c.name}</span>
        <ChevronRight aria-hidden className="size-4 text-muted" />
      </button>
    </Reorder.Item>
  );
}
