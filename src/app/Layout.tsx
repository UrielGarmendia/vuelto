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
import { useTxSheet } from '../features/transactions/store';
import { fade } from '../ui/motion';
import { Toaster } from '../ui/Toaster';
import { InstallBanner } from './InstallBanner';
import { useApplyPrefs, usePrefs } from './prefs';
import { TabBar } from './TabBar';
import { UpdatePrompt } from './UpdatePrompt';

// Own chunk (Radix + form); it starts loading on first render, well before the first tap on +.
const TransactionSheet = lazy(() =>
  import('../features/transactions/TransactionSheet').then((m) => ({
    default: m.TransactionSheet,
  })),
);

const loadFeatures = () => import('../ui/motion-features').then((r) => r.default);

const hasViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

/** Wraps every route (tab layout and onboarding) with theme and motion settings. */
export function Root() {
  useApplyPrefs();
  const reduceMotion = usePrefs((s) => s.reduceMotion);
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
        <Outlet />
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

  return (
    <>
      <div id="app" className="mx-auto min-h-dvh max-w-lg bg-bg pt-safe">
        <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          {hasViewTransitions ? (
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
      <TabBar />
      <InstallBanner />
      <UpdatePrompt />
      <Toaster />
      <Suspense>
        <TransactionSheet />
      </Suspense>
    </>
  );
}
