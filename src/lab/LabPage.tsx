import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router';

// Design lab (development only): three directions for Inicio and the entry sheet.
const Mix = lazy(() => import('./d/Mix'));

const directions = {
  d: { name: 'D · Noche con relieve', Component: Mix },
} as const;
type Dir = keyof typeof directions;

export function LabPage() {
  const [params, setParams] = useSearchParams();
  const d: Dir = 'd';
  const t = params.get('t') === 'dark' ? 'dark' : 'light';
  const rawView = params.get('v');
  const v = rawView === 'sheet' || rawView === 'list' || rawView === 'stats' ? rawView : 'home';
  const dial =
    (['budget', 'avg', 'none'] as const).find((x) => x === params.get('dial')) ?? 'budget';
  const bare = params.has('bare');

  const set = (k: string, val: string) => {
    const next = new URLSearchParams(params);
    next.set(k, val);
    setParams(next, { replace: true });
  };

  return (
    <>
      <Suspense>
        <Mix key={`${t}-${v}-${dial}`} theme={t} view={v} dial={dial} seg={params.get('seg')} />
      </Suspense>
      {!bare && (
        <div
          style={{
            position: 'fixed',
            top: 8,
            right: 8,
            zIndex: 100,
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 10,
            background: 'rgb(0 0 0 / 0.8)',
            color: '#fff',
            font: '12px system-ui',
          }}
        >
          {(Object.keys(directions) as Dir[]).map((k) => (
            <button
              key={k}
              onClick={() => set('d', k)}
              style={{ padding: '4px 8px', opacity: k === d ? 1 : 0.6 }}
            >
              {directions[k].name}
            </button>
          ))}
          <button
            onClick={() => set('t', t === 'dark' ? 'light' : 'dark')}
            style={{ padding: '4px 8px' }}
          >
            {t === 'dark' ? 'Oscuro' : 'Claro'}
          </button>
          {(['home', 'sheet', 'list', 'stats'] as const).map((x) => (
            <button
              key={x}
              onClick={() => set('v', x)}
              style={{ padding: '4px 8px', opacity: v === x ? 1 : 0.6 }}
            >
              {{ home: 'Inicio', sheet: 'Sheet', list: 'Movimientos', stats: 'Estadísticas' }[x]}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
