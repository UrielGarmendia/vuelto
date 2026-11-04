import { Delete } from 'lucide-react';
import type { AmountKey } from '../lib/amountInput';

const keys: AmountKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];

// Plain CSS press feedback: 12 Motion components here measurably slowed the sheet's first frame.
export function NumberPad({ onKey }: { onKey: (key: AmountKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1" role="group" aria-label="Teclado numérico">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === 'back' ? 'Borrar' : key === ',' ? 'Coma decimal' : key}
          onPointerDown={() => navigator.vibrate?.(10)}
          onClick={() => onKey(key)}
          className="tabular grid h-12 place-items-center rounded-sm text-[24px] font-medium transition-transform duration-100 select-none active:scale-95 active:bg-surface-2 motion-reduce:active:scale-100"
        >
          {key === 'back' ? <Delete aria-hidden className="size-6" strokeWidth={1.75} /> : key}
        </button>
      ))}
    </div>
  );
}
