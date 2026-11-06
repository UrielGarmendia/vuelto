import { Check } from 'lucide-react';
import { categoryIcons, iconLabels, palette } from './icons';

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Ícono" className="grid grid-cols-6 gap-1.5">
      {Object.entries(categoryIcons).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={iconLabels[name] ?? name}
          onClick={() => onChange(name)}
          className="grid aspect-square place-items-center rounded-sm text-muted transition-colors aria-checked:text-[var(--c)]"
          style={
            {
              '--c': color,
              backgroundColor:
                value === name ? `color-mix(in oklab, ${color} 16%, transparent)` : undefined,
            } as React.CSSProperties
          }
        >
          <Icon aria-hidden className="size-5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Color" className="grid grid-cols-8 gap-2">
      {palette.map(({ hex: c, name }) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c.toLowerCase()}
          aria-label={name}
          onClick={() => onChange(c)}
          className="grid aspect-square place-items-center rounded-full text-white ring-offset-2 ring-offset-ground aria-checked:ring-2 aria-checked:ring-ink"
          style={{ backgroundColor: c }}
        >
          {value.toLowerCase() === c.toLowerCase() && <Check aria-hidden className="size-4" />}
        </button>
      ))}
    </div>
  );
}
