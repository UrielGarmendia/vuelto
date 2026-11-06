import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="pt-2 pb-3">
      <h1 className="text-[22px] font-bold">{title}</h1>
      {children}
    </header>
  );
}
