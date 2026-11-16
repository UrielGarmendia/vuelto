import type { ReactNode } from 'react';

export interface DonutPart {
  id: string;
  cents: number;
}

/** Ring segments, clockwise from twelve o'clock. */
function donutArcs(parts: DonutPart[], total: number) {
  const R = 110;
  const r = 72;
  let angle = -Math.PI / 2;
  return parts.map((p) => {
    const sweep = (p.cents / total) * Math.PI * 2;
    const gap = parts.length > 1 ? 0.012 : 0;
    const a0 = angle + gap;
    // A single part is a full ring: stop just short so the arc stays drawable.
    const a1 = angle + Math.min(sweep, Math.PI * 2 - 0.0001) - gap;
    angle += sweep;
    const pt = (rad: number, a: number) =>
      `${(150 + rad * Math.cos(a)).toFixed(2)} ${(150 + rad * Math.sin(a)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return {
      ...p,
      mid: (a0 + a1) / 2,
      d: `M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z`,
    };
  });
}

/**
 * A ring whose parts open out when chosen. The centre (`children`) sits in the hole and is
 * the caller's: usually the total, or the chosen part with an action.
 */
export function DonutRing({
  parts,
  total,
  sel,
  onSelect,
  color,
  label,
  className = 'max-w-[380px]',
  children,
}: {
  parts: DonutPart[];
  total: number;
  sel: string | null;
  onSelect: (id: string | null) => void;
  color: (id: string) => string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const arcs = donutArcs(parts, total);
  return (
    <div className="donut relative grid flex-1 content-center justify-items-center py-2 [container-type:inline-size]">
      <svg
        viewBox="0 0 300 300"
        className={`w-full overflow-visible ${className}`}
        role="img"
        aria-label={label}
      >
        {arcs.map((a, i) => (
          <path
            key={a.id}
            d={a.d}
            fill={color(a.id)}
            opacity={sel && sel !== a.id ? 0.3 : 1}
            style={{
              animationDelay: `${i * 60}ms`,
              transform:
                sel === a.id
                  ? `translate(${Math.cos(a.mid) * 10}px, ${Math.sin(a.mid) * 10}px)`
                  : undefined,
            }}
            onClick={() => onSelect(sel === a.id ? null : a.id)}
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">{children}</div>
    </div>
  );
}
