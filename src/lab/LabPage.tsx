import { lazy, Suspense, useEffect } from 'react';
import { useSearchParams } from 'react-router';

// Design lab (development only): three directions for Inicio and the entry sheet.
const Mix = lazy(() => import('./d/Mix'));

const directions = {
  d: { name: 'D · Noche con relieve', Component: Mix },
  a: { name: 'A · Relieve', Component: lazy(() => import('./a/Relieve')) },
  b: { name: 'B · Ticket', Component: lazy(() => import('./b/Ticket')) },
  c: { name: 'C · Noche', Component: lazy(() => import('./c/Noche')) },
} as const;
type Dir = keyof typeof directions;

const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400..700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

export function LabPage() {
  const [params, setParams] = useSearchParams();
  const d = (params.get('d') ?? 'd') as Dir;
  const t = params.get('t') === 'dark' ? 'dark' : 'light';
  const rawView = params.get('v');
  const v = rawView === 'sheet' || rawView === 'list' || rawView === 'stats' ? rawView : 'home';
  const dial =
    (['budget', 'avg', 'none'] as const).find((x) => x === params.get('dial')) ?? 'budget';
  const bare = params.has('bare');
  // A, B and C share one signature; D (the mix) takes its own props below.
  const Other = (d === 'd' || !directions[d] ? directions.a : directions[d])
    .Component as typeof directions.a.Component;

  useEffect(() => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS });
    document.head.append(link);
    return () => link.remove();
  }, []);

  const set = (k: string, val: string) => {
    const next = new URLSearchParams(params);
    next.set(k, val);
    setParams(next, { replace: true });
  };

  return (
    <>
      <Suspense>
        {d === 'd' ? (
          <Mix key={`${t}-${v}-${dial}`} theme={t} view={v} dial={dial} seg={params.get('seg')} />
        ) : (
          <Other key={`${d}-${t}-${v}`} theme={t} view={v === 'sheet' ? 'sheet' : 'home'} />
        )}
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
