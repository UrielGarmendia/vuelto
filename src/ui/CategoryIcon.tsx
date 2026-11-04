import { CircleDashed } from 'lucide-react';
import { categoryIcons } from './icons';

interface Props {
  icon?: string;
  color?: string;
  size?: 'sm' | 'md';
}

/** Category icon on a soft tint of the category color. */
export function CategoryIcon({ icon, color = '#8a8379', size = 'md' }: Props) {
  const Icon = (icon && categoryIcons[icon]) || CircleDashed;
  const box = size === 'md' ? 'size-11 rounded-[14px]' : 'size-9 rounded-[12px]';
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center ${box}`}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-[18px]'} strokeWidth={2} />
    </span>
  );
}
