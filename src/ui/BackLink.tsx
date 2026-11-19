import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router';
import { previousPath, screenName } from './backTarget';
import { useGoBack } from './useGoBack';
import { viewTransitions } from '../app/viewTransitions';

/** Back to the previous screen, named after it; `to` when there is no in-app history. */
export function BackLink({ to }: { to: string }) {
  const goBack = useGoBack(to);
  const label = screenName(previousPath()) ?? screenName(to) ?? 'Volver';
  return (
    <Link
      to={to}
      replace
      viewTransition={viewTransitions}
      onClick={(e) => {
        e.preventDefault();
        goBack();
      }}
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-sm pr-3 text-[15px] font-medium text-hue"
    >
      <ChevronLeft aria-hidden className="size-5" /> {label}
    </Link>
  );
}
