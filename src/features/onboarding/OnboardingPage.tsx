import { HandCoins, ShieldCheck, WifiOff } from 'lucide-react';
import { m } from 'motion/react';
import { useNavigate } from 'react-router';
import { ease, spring } from '../../ui/motion';
import { availability } from '../sync/google';
import { useSync } from '../sync/useSync';
import { toast } from '../../ui/toast';
import { markOnboarded } from './onboarded';

const points = [
  { icon: HandCoins, title: 'Cargá un gasto en segundos', text: 'Monto, categoría y listo.' },
  { icon: WifiOff, title: 'Funciona sin conexión', text: 'Todo vive en tu dispositivo.' },
  {
    icon: ShieldCheck,
    title: 'Tus datos son tuyos',
    text: 'Sin cuentas obligatorias ni publicidad.',
  },
];

/** The app mark: a raised tile settles in, the month's ticks draw around it, then the V. */
function Logo() {
  return (
    <m.div
      aria-hidden
      className="rel grid size-36 place-items-center rounded-[38px]"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.snappy}
    >
      <svg viewBox="0 0 512 512" className="size-full">
        {Array.from({ length: 24 }, (_, i) => {
          const a = ((-210 + (240 * i) / 23) * Math.PI) / 180;
          return (
            <m.line
              key={i}
              x1={256 + 178 * Math.cos(a)}
              y1={276 + 178 * Math.sin(a)}
              x2={256 + 204 * Math.cos(a)}
              y2={276 + 204 * Math.sin(a)}
              stroke={i < 16 ? 'var(--color-hue)' : 'var(--color-idle)'}
              strokeWidth="14"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.15 + i * 0.025 }}
            />
          );
        })}
        <m.path
          d="M178 200 256 344 334 200"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="52"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.7, ease: ease.out }}
        />
      </svg>
    </m.div>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();

  function start() {
    markOnboarded();
    navigate('/', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-ground px-6 pt-safe pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mt-[12dvh] grid place-items-center">
        <Logo />
      </div>

      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.9, ease: ease.out }}
        className="mt-10"
      >
        <h1 className="font-wide text-[44px] leading-none font-extrabold tracking-[-0.03em]">
          vuelto
        </h1>
        <p className="mt-2 text-lg text-muted">Tus gastos, claros y al día.</p>
      </m.div>

      <ul className="mt-8 space-y-5">
        {points.map(({ icon: Icon, title, text }, i) => (
          <m.li
            key={title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 1 + i * 0.07, ease: ease.out }}
            className="flex gap-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-flat text-hue">
              <Icon aria-hidden className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-[14px] text-muted">{text}</span>
            </span>
          </m.li>
        ))}
      </ul>

      <div className="mt-auto grid gap-2 pt-8">
        <button
          type="button"
          onClick={start}
          className="rel go min-h-[58px] w-full rounded-[20px] text-[17px] font-bold"
        >
          Empezar
        </button>
        {availability() === 'ready' && (
          <button
            type="button"
            onClick={async () => {
              try {
                await useSync.getState().signIn();
                start();
              } catch {
                toast('Google no respondió. Podés iniciar sesión después desde Ajustes.');
              }
            }}
            className="min-h-12 text-[15px] font-semibold text-hue"
          >
            Ya uso Vuelto: iniciar sesión con Google
          </button>
        )}
      </div>
    </main>
  );
}
