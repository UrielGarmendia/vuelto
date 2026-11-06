import { LazyMotion, m, MotionConfig } from 'motion/react';
import { lazy, Suspense, useEffect } from 'react';
import {
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
  useOutlet,
  useSearchParams,
} from 'react-router';
import { isOnboarded } from '../features/onboarding/onboarded';
import { runRecurring } from '../features/transactions/create';
import { useSyncTriggers } from '../features/sync/useSync';
import { useTxSheet } from '../features/transactions/store';
import { todayISO } from '../lib/dates';
import { fade } from '../ui/motion';
import { Toaster } from '../ui/Toaster';
import { InstallBanner } from './InstallBanner';
import { useApplyPrefs, usePrefs } from './prefs';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { useOpenSearch } from './nav';
import { TopBar } from './TopBar';
import { UpdatePrompt } from './UpdatePrompt';
import { viewTransitions } from './viewTransitions';

// Own chunk (Radix + form); it starts loading on first render, well before the first tap on +.
const TransactionSheet = lazy(() =>
  import('../features/transactions/TransactionSheet').then((m) => ({
    default: m.TransactionSheet,
  })),
);

const loadFeatures = () => import('../ui/motion-features').then((r) => r.default);

/** Wraps every route (tab layout and onboarding) with theme and motion settings. */
export function Root() {
  useApplyPrefs();
  const reduceMotion = usePrefs((s) => s.reduceMotion);
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
        <Outlet />
        {/* Outside #app (fixed UI) and above every route, onboarding included. */}
        <Toaster />
        {/* New pages start at the top; back/forward returns to where you were. */}
        <ScrollRestoration />
      </MotionConfig>
    </LazyMotion>
  );
}

/** First launch goes through onboarding before the app. */
export function RequireOnboarded({ children }: { children: React.ReactNode }) {
  return isOnboarded() ? children : <Navigate to="/bienvenida" replace />;
}

export function Layout() {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();

  // Manifest shortcut "Nuevo gasto" opens /?nuevo=gasto.
  useEffect(() => {
    if (!params.has('nuevo')) return;
    useTxSheet.getState().openNew();
    setParams({}, { replace: true });
  }, [params, setParams]);

  useShortcuts();
  useRecurring();
  useSyncTriggers();

  return (
    <>
      <div id="app" className="min-h-dvh bg-ground pt-safe lg:pl-[232px]">
        <main className="mx-auto max-w-[1280px] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-6 lg:px-8 lg:pb-12">
          <TopBar />
          {viewTransitions ? (
            outlet
          ) : (
            // Fallback for browsers without the View Transitions API.
            <m.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fade}
            >
              {outlet}
            </m.div>
          )}
        </main>
      </div>
      {/* Fixed UI lives outside #app so scaling #app behind a sheet doesn't move it. */}
      <Sidebar />
      <TabBar />
      <InstallBanner />
      <UpdatePrompt />
      <Suspense>
        <TransactionSheet />
      </Suspense>
    </>
  );
}

/** Keyboard: N opens a new movement, / jumps to search. Esc is handled by whatever is open. */
function useShortcuts() {
  const openSearch = useOpenSearch();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (useTxSheet.getState().open) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        useTxSheet.getState().openNew();
      } else if (e.key === '/') {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
}

/** Repeating movements that came due are created when the app opens or comes back to the front. */
function useRecurring() {
  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      runRecurring(todayISO()).catch((err) => console.error(err));
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, []);
}
