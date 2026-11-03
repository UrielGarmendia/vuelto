import { LazyMotion, m, MotionConfig } from 'motion/react';
import { useLocation, useOutlet } from 'react-router';
import { fade } from '../ui/motion';
import { InstallBanner } from './InstallBanner';
import { useApplyPrefs, usePrefs } from './prefs';
import { TabBar } from './TabBar';
import { UpdatePrompt } from './UpdatePrompt';

const loadFeatures = () => import('../ui/motion-features').then((r) => r.default);

const hasViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

export function Layout() {
  useApplyPrefs();
  const reduceMotion = usePrefs((s) => s.reduceMotion);
  const outlet = useOutlet();
  const { pathname } = useLocation();

  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
        <div id="app" className="mx-auto min-h-dvh max-w-lg pt-safe">
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
          <InstallBanner />
          <UpdatePrompt />
          <TabBar />
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
