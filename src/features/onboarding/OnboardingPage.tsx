import { HandCoins, ShieldCheck, WifiOff } from 'lucide-react';
import { m } from 'motion/react';
import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { usePrefs } from '../../app/prefs';
import { canUse3D } from '../../three/capability';
import { ease } from '../../ui/motion';
import { markOnboarded } from './onboarded';

const CoinScene = lazy(() => import('../../three/CoinScene'));

const points = [
  { icon: HandCoins, title: 'Cargá un gasto en segundos', text: 'Monto, categoría y listo.' },
  { icon: WifiOff, title: 'Funciona sin conexión', text: 'Todo vive en tu celular.' },
  { icon: ShieldCheck, title: 'Tus datos son tuyos', text: 'Sin cuentas ni publicidad.' },
];

/** 2D stand-in for the 3D coin: same mark, gentle float, nothing to load. */
function FlatCoin() {
  return (
    <div className="grid size-full place-items-center">
      <svg viewBox="0 0 200 200" aria-hidden className="size-44 motion-safe:animate-float">
        <circle cx="100" cy="100" r="92" fill="#D9653B" />
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="#F6F2EC"
          strokeOpacity=".35"
          strokeWidth="4"
        />
        <path
          d="M68 70 100 134 132 70"
          fill="none"
          stroke="#F6F2EC"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** If the 3D chunk can't load (e.g. first launch offline), render nothing: the flat coin stays. */
class Fallback2D extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const reduceMotion = usePrefs((s) => s.reduceMotion);
  const [use3D] = useState(() => canUse3D(reduceMotion));
  const [coinReady, setCoinReady] = useState(false);

  function start() {
    markOnboarded();
    navigate('/', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-bg px-6 pt-safe pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="relative mt-6 h-[38dvh] min-h-56" data-coin={use3D ? '3d' : '2d'}>
        {/* The flat coin stays until the 3D one has drawn its first frame: no empty gap. */}
        {!coinReady && (
          <div className="absolute inset-0">
            <FlatCoin />
          </div>
        )}
        {use3D && (
          <Fallback2D>
            <Suspense fallback={null}>
              <CoinScene
                onReady={() => setCoinReady(true)}
                className={`size-full transition-opacity duration-300 ${coinReady ? 'opacity-100' : 'opacity-0'}`}
              />
            </Suspense>
          </Fallback2D>
        )}
      </div>

      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: ease.out }}
        className="mt-4"
      >
        <h1 className="text-[40px] leading-none font-semibold tracking-tight">Vuelto</h1>
        <p className="mt-2 text-lg text-muted">Tus gastos, claros y al día.</p>
      </m.div>

      <ul className="mt-8 space-y-5">
        {points.map(({ icon: Icon, title, text }, i) => (
          <m.li
            key={title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 + i * 0.07, ease: ease.out }}
            className="flex gap-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-accent-ink">
              <Icon aria-hidden className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted">{text}</span>
            </span>
          </m.li>
        ))}
      </ul>

      <button
        type="button"
        onClick={start}
        className="mt-auto min-h-13 w-full rounded-md bg-accent-ink text-[17px] font-semibold text-on-accent"
      >
        Empezar
      </button>
    </main>
  );
}
