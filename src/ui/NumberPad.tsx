import { Delete } from 'lucide-react';
import type { AmountKey } from '../lib/amountInput';

const keys: AmountKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];

// Plain CSS relief (styles.css): 12 Motion components here measurably slowed the sheet's first frame.
export function NumberPad({ onKey }: { onKey: (key: AmountKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Teclado numérico">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === 'back' ? 'Borrar' : key === ',' ? 'Coma decimal' : key}
          onPointerDown={() => navigator.vibrate?.(10)}
          onClick={() => onKey(key)}
          className="rel tabular grid h-[52px] place-items-center rounded-[18px] text-[24px] font-semibold select-none"
        >
          {key === 'back' ? <Delete aria-hidden className="size-[23px]" strokeWidth={1.8} /> : key}
        </button>
      ))}
    </div>
  );
}
