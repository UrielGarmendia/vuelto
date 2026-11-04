import {
  Briefcase,
  Building2,
  Bus,
  CircleDashed,
  Coins,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Lightbulb,
  PartyPopper,
  PawPrint,
  Repeat,
  Shirt,
  ShoppingCart,
  Sofa,
  Stethoscope,
  Utensils,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

// Explicit map so only these icons end up in the bundle.
const categoryIcons: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  bus: Bus,
  fuel: Fuel,
  house: House,
  'building-2': Building2,
  lightbulb: Lightbulb,
  wifi: Wifi,
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  'graduation-cap': GraduationCap,
  shirt: Shirt,
  'party-popper': PartyPopper,
  repeat: Repeat,
  gift: Gift,
  'paw-print': PawPrint,
  sofa: Sofa,
  landmark: Landmark,
  briefcase: Briefcase,
  laptop: Laptop,
  coins: Coins,
};

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
