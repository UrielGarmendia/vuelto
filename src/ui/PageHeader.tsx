import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="px-5 pt-6 pb-2">
      <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}
