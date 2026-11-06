import { lazy, Suspense, useEffect } from 'react';
import { useSearchParams } from 'react-router';

// Design lab (development only): three directions for Inicio and the entry sheet.
const directions = {
  a: { name: 'A · Relieve', Component: lazy(() => import('./a/Relieve')) },
  b: { name: 'B · Ticket', Component: lazy(() => import('./b/Ticket')) },
  c: { name: 'C · Noche', Component: lazy(() => import('./c/Noche')) },
} as const;
type Dir = keyof typeof directions;

const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400..700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

export function LabPage() {
  const [params, setParams] = useSearchParams();
  const d = (params.get('d') ?? 'a') as Dir;
  const t = params.get('t') === 'dark' ? 'dark' : 'light';
  const v = params.get('v') === 'sheet' ? 'sheet' : 'home';
  const bare = params.has('bare');
  const { Component } = directions[d] ?? directions.a;

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
        <Component key={`${d}-${t}-${v}`} theme={t} view={v} />
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
          <button
            onClick={() => set('v', v === 'sheet' ? 'home' : 'sheet')}
            style={{ padding: '4px 8px' }}
          >
            {v === 'sheet' ? 'Sheet' : 'Inicio'}
          </button>
        </div>
      )}
    </>
  );
}
