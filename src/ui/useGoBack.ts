import { useNavigate } from 'react-router';

/**
 * Pops history when there is an in-app entry to return to (no duplicate entries); otherwise,
 * e.g. on a shared link or reload, replaces the current entry with `to`.
 */
export function useGoBack(to: string) {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) void navigate(-1);
    else void navigate(to, { replace: true, viewTransition: true });
  };
}
