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
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="rel mb-6 grid size-20 place-items-center rounded-[26px]">
        <Icon aria-hidden className="size-8 text-hue" strokeWidth={1.75} />
      </div>
      <h2 className="text-[18px] font-semibold">{title}</h2>
      {children && (
        <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-muted">{children}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
