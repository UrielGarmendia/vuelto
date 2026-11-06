import { GripVertical } from 'lucide-react';
import { useDragControls } from 'motion/react';
import { Reorder } from 'motion/react-m';
import { homeWidgetNames, usePrefs, withAllWidgets, type WidgetPref } from '../../app/prefs';
import { BackLink } from '../../ui/BackLink';

/** Order and show or hide the blocks on Inicio. */
export function HomeWidgetsPage() {
  const widgets = withAllWidgets(usePrefs((s) => s.homeWidgets));
  const save = usePrefs((s) => s.setHomeWidgets);
  return (
    <div className="mx-auto max-w-[720px] pt-1">
      <BackLink to="/" label="Inicio" />
      <h1 className="mt-2 text-[22px] font-bold">Personalizar Inicio</h1>
      <p id="widgets-hint" className="mt-1 mb-4 text-[14px] text-muted">
        Arrastrá desde la manija para cambiar el orden (con teclado: Espacio agarra y las flechas
        mueven). El interruptor muestra u oculta cada bloque.
      </p>
      <Reorder.Group
        axis="y"
        values={widgets}
        onReorder={save}
        aria-describedby="widgets-hint"
        className="divide-y divide-line overflow-hidden rounded-[22px] bg-flat"
      >
        {widgets.map((w) => (
          <Row
            key={w.id}
            widget={w}
            onToggle={() =>
              save(widgets.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)))
            }
          />
        ))}
      </Reorder.Group>
    </div>
  );
}

function Row({ widget: w, onToggle }: { widget: WidgetPref; onToggle: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={w}
      dragListener={false}
      dragControls={controls}
      className="flex min-h-14 list-none items-center gap-2 bg-flat pr-4"
    >
      <span
        aria-hidden
        onPointerDown={(e) => controls.start(e)}
        className="grid h-14 w-11 shrink-0 cursor-grab touch-none place-items-center text-faint"
      >
        <GripVertical className="size-5" />
      </span>
      <span className={`flex-1 text-[15px] ${w.visible ? '' : 'text-faint'}`}>
        {homeWidgetNames[w.id]}
      </span>
      <label className="relative flex min-h-11 items-center">
        <input
          type="checkbox"
          role="switch"
          checked={w.visible}
          onChange={onToggle}
          aria-label={`Mostrar ${homeWidgetNames[w.id]}`}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="well relative h-8 w-[52px] shrink-0 rounded-full transition-colors peer-checked:bg-hue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hue after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-[linear-gradient(145deg,var(--color-face-a),var(--color-face-b))] after:shadow-[var(--rise)] after:transition-transform after:duration-300 peer-checked:after:translate-x-5"
        />
      </label>
    </Reorder.Item>
  );
}
