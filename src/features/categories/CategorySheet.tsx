import { Archive } from 'lucide-react';
import { useState } from 'react';
import { saveCategory, setArchived } from '../../db/catalog';
import type { Category } from '../../db/types';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { ColorPicker, IconPicker } from '../../ui/Pickers';
import { Sheet, SheetDragZone } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Editing this one; otherwise creating a new category of `type`. */
  category?: Category;
  type: 'expense' | 'income';
  session: number;
}

export function CategorySheet({ open, onClose, category, type, session }: Props) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
    >
      <Form key={session} category={category} type={type} onDone={onClose} />
    </Sheet>
  );
}

function Form({
  category,
  type,
  onDone,
}: {
  category?: Category;
  type: 'expense' | 'income';
  onDone: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'sparkles');
  const [color, setColor] = useState(category?.color ?? '#D9653B');

  async function save() {
    try {
      await saveCategory({ name, icon, color, type: category?.type ?? type }, category?.id);
      onDone();
      toast(category ? 'Categoría actualizada' : 'Categoría creada');
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar la categoría.');
    }
  }

  async function archive() {
    if (!category) return;
    await setArchived('categories', category.id, 1);
    onDone();
    toast('Categoría archivada', {
      label: 'Deshacer',
      onClick: () => void setArchived('categories', category.id, 0),
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-5 px-5 pt-1 pb-4"
    >
      <SheetDragZone className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} />
        <h2 className="text-lg font-semibold">
          {category ? 'Editar categoría' : 'Nueva categoría'}
        </h2>
      </SheetDragZone>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          autoFocus={!category}
          className="min-h-12 w-full rounded-sm bg-surface-2 px-4 text-[16px] focus-visible:outline-2 focus-visible:outline-accent-ink"
        />
      </label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-muted">Color</legend>
        <ColorPicker value={color} onChange={setColor} />
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-muted">Ícono</legend>
        <IconPicker value={icon} color={color} onChange={setIcon} />
      </fieldset>
      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-bg px-5 pt-2 pb-1">
        {category && (
          <button
            type="button"
            onClick={archive}
            className="flex min-h-12 items-center gap-1.5 rounded-md bg-surface-2 px-4 font-semibold text-expense"
          >
            <Archive aria-hidden className="size-4" /> Archivar
          </button>
        )}
        <button
          type="submit"
          disabled={!name.trim()}
          className="min-h-12 flex-1 rounded-md bg-accent-ink font-semibold text-on-accent disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
