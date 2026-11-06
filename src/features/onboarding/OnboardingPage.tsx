import { HandCoins, ShieldCheck, WifiOff } from 'lucide-react';
import { m } from 'motion/react';
import { useNavigate } from 'react-router';
import { ease, spring } from '../../ui/motion';
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

/** The app mark: the tile settles in, then the V draws itself. */
function Logo() {
  return (
    <m.svg
      viewBox="0 0 512 512"
      aria-hidden
      className="size-36"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.snappy}
    >
      <rect width="512" height="512" rx="112" fill="#D9653B" />
      <m.path
        d="M164 176 256 344 348 176"
        fill="none"
        stroke="#F6F2EC"
        strokeWidth="60"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: ease.out }}
      />
    </m.svg>
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
        transition={{ duration: 0.4, delay: 0.35, ease: ease.out }}
        className="mt-10"
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
            transition={{ duration: 0.35, delay: 0.45 + i * 0.07, ease: ease.out }}
            className="flex gap-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-flat-2 text-hue">
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
        className="mt-auto min-h-13 w-full rounded-md bg-hue text-[17px] font-semibold text-on-hue"
      >
        Empezar
      </button>
    </main>
  );
}
