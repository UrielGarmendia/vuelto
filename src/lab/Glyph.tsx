import { CircleDashed } from 'lucide-react';
import { categoryIcons } from '../ui/icons';

export function Glyph({ icon, className }: { icon: string; className?: string }) {
  const Icon = categoryIcons[icon] ?? CircleDashed;
  return <Icon aria-hidden className={className} strokeWidth={1.9} />;
}
