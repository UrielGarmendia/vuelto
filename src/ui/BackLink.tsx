import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router';
import { useGoBack } from './useGoBack';
import { viewTransitions } from '../app/viewTransitions';

export function BackLink({ to, label = 'Volver' }: { to: string; label?: string }) {
  const goBack = useGoBack(to);
  return (
    <Link
      to={to}
      replace
      viewTransition={viewTransitions}
      onClick={(e) => {
        e.preventDefault();
        goBack();
      }}
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-sm pr-3 text-[15px] font-medium text-accent-ink"
    >
      <ChevronLeft aria-hidden className="size-5" /> {label}
    </Link>
  );
}
