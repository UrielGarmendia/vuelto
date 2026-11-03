import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children, action }: Props) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="relative mb-6 grid size-24 place-items-center">
        <div className="absolute inset-0 rotate-6 rounded-[28px] bg-surface-2" />
        <div className="absolute inset-2 -rotate-3 rounded-[24px] bg-surface shadow-soft" />
        <Icon aria-hidden className="relative size-9 text-accent" strokeWidth={1.75} />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children && (
        <p className="mt-2 max-w-64 text-[15px] leading-relaxed text-muted">{children}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
