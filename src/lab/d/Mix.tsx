import {
  CalendarDays,
  ChartPie,
  ChevronDown,
  Delete,
  House,
  NotebookPen,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { dialBaseline, dialSummary, dialTicks, type TickState } from '../../features/home/dial';
import { formatDay } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import {
  accounts,
  available,
  balances,
  budget,
  byCategory,
  cardDebt,
  categories,
  daily,
  earned,
  history,
  insight,
  lastMonth,
  overBudget,
  projectedSpend,
  spent,
  today,
  txs,
} from '../data';
import { Glyph } from '../Glyph';
import { Odometer } from '../Odometer';
import { keyLabel, keys, sheetCategories, signed, useEntry } from '../shared';
import './mix.css';

export type MixView = 'home' | 'sheet' | 'list' | 'stats';
type DialVariant = 'budget' | 'avg' | 'none';

const nav = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'list', label: 'Movimientos', icon: ReceiptText },
  { id: 'stats', label: 'Estadísticas', icon: ChartPie },
  { id: 'settings', label: 'Ajustes', icon: Settings },
] as const;

const now = new Date(2026, 10, 22);
const iso = (day: number) => `2026-11-${String(day).padStart(2, '0')}`;

function CatIcon({ id }: { id: string }) {
  const c = categories[id]!;
  return (
    <span className="mx-ico" style={{ color: c.color }}>
      <Glyph icon={c.icon} />
    </span>
  );
}

/* ---------------- Dial ---------------- */

const tickColor: Record<TickState, string> = {
  under: 'var(--hue)',
  over: 'var(--over)',
  spent: 'var(--hue)',
  quiet: 'var(--idle)',
  ahead: 'var(--idle)',
};

function MonthDial({ variant }: { variant: DialVariant }) {
  const n = today.daysInMonth;
  const past = [...history].reverse().map((m) => ({ days: m.days, spentCents: m.cents }));
  const baseline =
    variant === 'budget'
      ? dialBaseline(budget, past, n)
      : variant === 'avg'
        ? dialBaseline(undefined, past, n)
        : dialBaseline(undefined, [], n);
  const states = dialTicks(daily, today.day, baseline);
  const summary = dialSummary(spent, today.day, n, baseline);
  const cx = 180;
  const cy = 176;

  return (
    <div className="mx-dial">
      <svg viewBox="0 0 360 310" role="img" aria-label={`Día ${today.day} de ${n}`}>
        {states.map((st, i) => {
          const a = ((-210 + (240 * i) / (n - 1)) * Math.PI) / 180;
          const r1 = 132;
          const r2 = st === 'ahead' ? 150 : 162;
          return (
            <line
              key={i}
              className="mx-tick"
              x1={cx + r1 * Math.cos(a)}
              y1={cy + r1 * Math.sin(a)}
              x2={cx + r2 * Math.cos(a)}
              y2={cy + r2 * Math.sin(a)}
              stroke={tickColor[st]}
              style={{ animationDelay: `${i * 26}ms` }}
            />
          );
        })}
      </svg>
      <div className="mx-center">
        {summary.mode === 'budget' && (
          <>
            <span className="big wide">{summary.percentOfBudget} %</span>
            <p>del presupuesto</p>
          </>
        )}
        {summary.mode === 'average' && (
          <>
            <span className="big wide">
              {summary.percentVsAverage > 0 ? '+' : '−'}
              {Math.abs(summary.percentVsAverage)} %
            </span>
            <p>contra tu promedio a esta altura</p>
          </>
        )}
        {summary.mode === 'none' && (
          <>
            <span className="big amount wide">{formatMoney(summary.spentCents)}</span>
            <p>gastado en {today.monthName}</p>
          </>
        )}
      </div>
      {baseline.mode === 'budget' && (
        <p className="mx-dial-foot">
          Gastaste <b className="tab">{formatMoney(spent)}</b> de {formatMoney(budget)}
        </p>
      )}
      {baseline.mode === 'average' && (
        <p className="mx-dial-foot">
          Tu promedio es{' '}
          <b className="tab">{formatMoney(Math.round(baseline.perDay! / 100) * 100)}</b> por día
        </p>
      )}
      <p className="mx-key">
        {baseline.mode === 'none' ? (
          <span>Cargá unas semanas y vas a ver cómo viene cada día.</span>
        ) : (
          <>
            <span>
              <i style={{ background: 'var(--hue)' }} />
              {baseline.mode === 'budget'
                ? 'dentro del presupuesto diario'
                : 'debajo de tu promedio'}
            </span>
            <span>
              <i style={{ background: 'var(--over)' }} />
              día que te pasaste
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/* ---------------- Shell ---------------- */

function Shell({ view, children }: { view: MixView; children: React.ReactNode }) {
  const current = view === 'sheet' ? 'home' : view;
  return (
    <div className="mx-app">
      <nav className="mx-side" aria-label="Principal">
        <span className="mx-word">vuelto</span>
        {nav.map(({ id, label, icon: Icon }) => (
          <a key={id} href="#" aria-current={id === current ? 'page' : undefined}>
            <Icon aria-hidden size={17} /> {label}
          </a>
        ))}
      </nav>
      <div className="mx-bar">
        <span className="mx-word">vuelto</span>
        <span className="mx-search well">
          <Search aria-hidden size={16} /> Buscar movimientos <kbd>/</kbd>
        </span>
        <button type="button" className="mx-cta rel go">
          <Plus aria-hidden size={17} strokeWidth={2.4} /> Cargar
        </button>
      </div>
      {children}
      <nav className="mx-tabs" aria-label="Principal">
        {nav.slice(0, 2).map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            className="mx-tab"
            href="#"
            aria-current={id === current ? 'page' : undefined}
          >
            <Icon aria-hidden size={21} />
            {label}
          </a>
        ))}
        <button type="button" className="mx-plus rel go" aria-label="Cargar movimiento">
          <Plus aria-hidden size={28} strokeWidth={2.4} />
        </button>
        {nav.slice(2).map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            className="mx-tab"
            href="#"
            aria-current={id === current ? 'page' : undefined}
          >
            <Icon aria-hidden size={21} />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

/* ---------------- Inicio ---------------- */

function Home({ dial }: { dial: DialVariant }) {
  const recent = [...txs].reverse().slice(0, 5);
  return (
    <>
      <header className="mx-title">
        <h1>Noviembre</h1>
        {dial === 'budget' ? (
          <p>
            A este ritmo te pasás <b className="tab">{formatMoney(overBudget)}</b> del presupuesto.
            Faltan {today.daysInMonth - today.day} días.
          </p>
        ) : (
          <p>
            Domingo {today.day}. Faltan {today.daysInMonth - today.day} días para fin de mes.
          </p>
        )}
      </header>
      <div className="mx-grid home">
        <section className="mx-plain" aria-label="Cómo viene el mes">
          <MonthDial variant={dial} />
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="mx-balance rel" aria-labelledby="mx-av">
            <p id="mx-av" className="label">
              Disponible
            </p>
            <Odometer cents={available} className="big wide" />
            <dl className="mx-kpis">
              <div>
                <dt>Entró</dt>
                <dd className="tab">{formatMoney(earned)}</dd>
              </div>
              <div>
                <dt>Salió</dt>
                <dd className="tab">{formatMoney(spent)}</dd>
              </div>
              <div>
                <dt>Tarjeta</dt>
                <dd className="tab">{formatMoney(cardDebt)}</dd>
              </div>
            </dl>
          </section>
          <p className="mx-insight">
            <Sparkles
              aria-hidden
              size={18}
              style={{ color: 'var(--over)', flexShrink: 0, marginTop: 2 }}
            />
            <span>
              Comida afuera va{' '}
              <b className="tab" style={{ color: 'var(--over)' }}>
                +{insight.pct} %
              </b>{' '}
              contra octubre: {formatMoney(insight.now)} frente a {formatMoney(insight.before)}.
            </span>
          </p>
          <section className="mx-sec" aria-labelledby="mx-acc">
            <div className="head">
              <h2 id="mx-acc">Cuentas</h2>
              <span>Tocá para ver detalle</span>
            </div>
            <div className="mx-accounts">
              {accounts.map((a) => (
                <button key={a.id} type="button" className="mx-acc rel">
                  <span className="n">{a.name}</span>
                  <span
                    className="v tab"
                    style={balances[a.id]! < 0 ? { color: 'var(--negative)' } : undefined}
                  >
                    {signed(balances[a.id]!)}
                  </span>
                  {a.kind === 'credit' && <span className="s">Cierra el 28</span>}
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="mx-plain span" aria-labelledby="mx-rec">
          <div className="head">
            <h2 id="mx-rec">Últimos movimientos</h2>
            <span>Ver todos</span>
          </div>
          <ul className="mx-list">
            {recent.map((t, i) => (
              <li key={i} className="mx-row">
                <CatIcon id={t.cat} />
                <span className="t">
                  <b>{t.note}</b>
                  <span>{categories[t.cat]!.name}</span>
                </span>
                <span
                  className="v tab"
                  style={t.kind === 'income' ? { color: 'var(--positive)' } : undefined}
                >
                  {t.kind === 'income' ? '+' : '−'}
                  {formatMoney(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

/* ---------------- Sheet ---------------- */

function Sheet() {
  const e = useEntry();
  return (
    <>
      <div className="mx-scrim" />
      <div className="mx-sheet" role="dialog" aria-label="Nuevo movimiento">
        <div className="mx-grip" />
        <div className="mx-seg well" role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" aria-checked="true" className="rel">
            Gasto
          </button>
          <button type="button" role="radio" aria-checked="false">
            Ingreso
          </button>
        </div>
        <p className="mx-entry wide" aria-live="polite">
          <small>$</small>
          {e.display}
        </p>
        <div className="mx-cats" role="radiogroup" aria-label="Categoría">
          {sheetCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={e.cat === c.id}
              className="rel"
              onClick={() => e.setCat(c.id)}
            >
              <CatIcon id={c.id} />
              {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="mx-meta">
          <span className="well">
            <CalendarDays aria-hidden size={15} /> Hoy
          </span>
          <span className="well">
            <Wallet aria-hidden size={15} /> Visa
          </span>
          <span className="well">
            <NotebookPen aria-hidden size={15} /> Nota
          </span>
        </div>
        <div className="mx-keys" role="group" aria-label="Teclado numérico">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className="rel tab"
              aria-label={keyLabel(k)}
              onClick={() => e.press(k)}
            >
              {k === 'back' ? <Delete aria-hidden size={23} style={{ margin: '0 auto' }} /> : k}
            </button>
          ))}
        </div>
        <button type="button" className="mx-save rel go">
          Guardar gasto
        </button>
      </div>
    </>
  );
}

/* ---------------- Movimientos ---------------- */

function List() {
  const days = [...new Set([...txs].reverse().map((t) => t.day))];
  const [selected] = useState(txs[txs.length - 1]!);
  const sel = categories[selected.cat]!;
  return (
    <>
      <header className="mx-title">
        <h1>Movimientos</h1>
        <p>
          {txs.length} en {today.monthName}: entraron {formatMoney(earned)} y salieron{' '}
          {formatMoney(spent)}.
        </p>
      </header>
      <div className="mx-tools">
        <label className="mx-searchbox well">
          <Search aria-hidden size={17} />
          <span>Buscar por nota, categoría o monto</span>
        </label>
        <div className="mx-chips">
          {[{ l: 'Este mes', on: true }, { l: 'Tipo' }, { l: 'Categoría' }, { l: 'Cuenta' }].map(
            (c) => (
              <button
                key={c.l}
                type="button"
                className="rel"
                aria-pressed={c.on ? 'true' : 'false'}
              >
                {c.l} <ChevronDown aria-hidden size={15} />
              </button>
            ),
          )}
        </div>
      </div>
      <div className="mx-grid list">
        <section aria-label="Lista de movimientos">
          {days.map((day) => {
            const rows = txs.filter((t) => t.day === day).reverse();
            const net = rows.reduce((a, t) => a + (t.kind === 'income' ? t.amount : -t.amount), 0);
            return (
              <div key={day}>
                <h2 className="mx-day">
                  <span>{formatDay(iso(day), now)}</span>
                  <span className="tab">{signed(net)}</span>
                </h2>
                <ul className="mx-plain" style={{ padding: '4px 18px' }}>
                  {rows.map((t, i) => (
                    <li key={i} className="mx-row">
                      <CatIcon id={t.cat} />
                      <span className="t">
                        <b>{t.note}</b>
                        <span>
                          {categories[t.cat]!.name},{' '}
                          {accounts.find((a) => a.id === t.account)!.name}
                        </span>
                      </span>
                      <span
                        className="v tab"
                        style={t.kind === 'income' ? { color: 'var(--positive)' } : undefined}
                      >
                        {t.kind === 'income' ? '+' : '−'}
                        {formatMoney(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
        <aside className="mx-detail" aria-label="Detalle">
          <div className="mx-balance rel" style={{ textAlign: 'center' }}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
              <CatIcon id={selected.cat} />
              <p className="label">{sel.name}</p>
              <p className="big wide" style={{ fontSize: 40 }}>
                −{formatMoney(selected.amount)}
              </p>
            </div>
            <dl className="mx-list" style={{ marginTop: 18, textAlign: 'left' }}>
              {[
                ['Nota', selected.note],
                ['Fecha', formatDay(iso(selected.day), now)],
                ['Cuenta', accounts.find((a) => a.id === selected.account)!.name],
              ].map(([k, v]) => (
                <div key={k} className="mx-row" style={{ minHeight: 48 }}>
                  <dt className="t" style={{ color: 'var(--muted)' }}>
                    {k}
                  </dt>
                  <dd className="v">{v}</dd>
                </div>
              ))}
            </dl>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}
            >
              <button type="button" className="mx-cta rel" style={{ justifyContent: 'center' }}>
                Editar
              </button>
              <button
                type="button"
                className="mx-cta rel"
                style={{ justifyContent: 'center', color: 'var(--negative)' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

/* ---------------- Estadísticas ---------------- */

function useDonut() {
  const top = byCategory.slice(0, 6);
  const rest = spent - top.reduce((a, c) => a + c.cents, 0);
  const parts = [...top.map((c) => ({ id: c.cat, cents: c.cents })), { id: 'otros', cents: rest }];
  const R = 110;
  const r = 72;
  let angle = -Math.PI / 2;
  const arcs = parts.map((p) => {
    const sweep = (p.cents / spent) * Math.PI * 2;
    const a0 = angle + 0.012;
    const a1 = angle + sweep - 0.012;
    angle += sweep;
    const mid = (a0 + a1) / 2;
    const pt = (rad: number, a: number) => `${150 + rad * Math.cos(a)} ${150 + rad * Math.sin(a)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z`;
    return { ...p, d, mid };
  });
  return arcs;
}
const color = (id: string) => (id === 'otros' ? 'var(--idle)' : categories[id]!.color);
const name = (id: string) => (id === 'otros' ? 'Otros' : categories[id]!.name);
type Arc = ReturnType<typeof useDonut>[number];

function Donut({
  arcs,
  sel,
  setSel,
}: {
  arcs: Arc[];
  sel: string | null;
  setSel: (id: string | null) => void;
}) {
  const focus = arcs.find((a) => a.id === sel);
  return (
    <section className="mx-plain" aria-labelledby="mx-cat">
      <div className="head">
        <h2 id="mx-cat">En qué se fue la plata</h2>
        <span>{today.monthName}</span>
      </div>
      <div className="mx-donut">
        <svg viewBox="0 0 300 300" role="img" aria-label="Gasto por categoría">
          {arcs.map((a) => (
            <path
              key={a.id}
              d={a.d}
              fill={color(a.id)}
              opacity={sel && sel !== a.id ? 0.35 : 1}
              style={{
                transform:
                  sel === a.id
                    ? `translate(${Math.cos(a.mid) * 10}px, ${Math.sin(a.mid) * 10}px)`
                    : undefined,
              }}
              onClick={() => setSel(sel === a.id ? null : a.id)}
            />
          ))}
        </svg>
        <div className="mx-donut-center">
          <p>{focus ? name(focus.id) : 'Total'}</p>
          <span className="big tab">{formatMoney(focus ? focus.cents : spent)}</span>
          <p>
            {focus
              ? `${Math.round((focus.cents / spent) * 100)} % del mes`
              : `al ${today.day} de nov`}
          </p>
        </div>
      </div>
    </section>
  );
}

function Legend({
  arcs,
  sel,
  setSel,
}: {
  arcs: Arc[];
  sel: string | null;
  setSel: (id: string | null) => void;
}) {
  return (
    <section className="mx-plain" aria-labelledby="mx-leg">
      <div className="head">
        <h2 id="mx-leg">Por categoría</h2>
        <span>contra octubre</span>
      </div>
      <div className="mx-legend">
        {arcs.map((a) => {
          const before = lastMonth[a.id];
          const diff = before ? Math.round(((a.cents - before) / before) * 100) : null;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={sel === a.id}
              onClick={() => setSel(sel === a.id ? null : a.id)}
            >
              <span className="sw" style={{ background: color(a.id) }} />
              {name(a.id)}
              <span className="v tab">{formatMoney(a.cents)}</span>
              <span
                className="d tab"
                style={{ color: diff !== null && diff > 0 ? 'var(--over)' : 'var(--faint)' }}
              >
                {diff === null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)} %`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthBars() {
  const W = 360;
  const H = 170;
  const bars = [
    ...history.map((h) => ({ label: h.label, cents: h.cents, now: false })),
    { label: 'nov', cents: spent, now: true },
  ];
  const max = Math.max(projectedSpend, ...bars.map((b) => b.cents)) * 1.08;
  const bw = (W - 8) / bars.length;
  const y = (c: number) => H - 22 - (c / max) * (H - 34);
  const avg = history.slice(-3).reduce((a, h) => a + h.cents, 0) / 3;
  return (
    <section className="mx-plain" aria-labelledby="mx-months">
      <div className="head">
        <h2 id="mx-months">Últimos 12 meses</h2>
        <span>promedio de 3 meses {formatMoney(Math.round(avg / 100) * 100)}</span>
      </div>
      <svg
        className="mx-months"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Gasto por mes, últimos 12 meses"
      >
        {bars.map((b, i) => (
          <g key={b.label}>
            {b.now && (
              <rect
                x={i * bw + bw * 0.18}
                y={y(projectedSpend)}
                width={bw * 0.64}
                height={y(b.cents) - y(projectedSpend)}
                fill="none"
                stroke="var(--hue)"
                strokeDasharray="3 3"
                rx="3"
              />
            )}
            <rect
              x={i * bw + bw * 0.18}
              y={y(b.cents)}
              width={bw * 0.64}
              height={H - 22 - y(b.cents)}
              fill={b.now ? 'var(--hue)' : 'var(--idle)'}
              rx="3"
              style={{ animationDelay: `${i * 40}ms` }}
            />
            <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle">
              {b.label}
            </text>
          </g>
        ))}
        <line x1="0" x2={W} y1={y(avg)} y2={y(avg)} stroke="var(--faint)" strokeDasharray="2 4" />
      </svg>
    </section>
  );
}

function Stats({ seg }: { seg: string | null }) {
  const arcs = useDonut();
  const [sel, setSel] = useState<string | null>(seg);
  const oct = history[history.length - 1]!.cents;
  const vsOct = Math.round(((projectedSpend - oct) / oct) * 100);
  return (
    <>
      <header className="mx-title">
        <h1>Estadísticas</h1>
        <p>
          Noviembre viene {vsOct > 0 ? 'más caro' : 'más barato'} que octubre: proyectás{' '}
          <b className="tab">{formatMoney(projectedSpend)}</b> contra {formatMoney(oct)}.
        </p>
      </header>
      <div className="mx-grid stats">
        <dl className="mx-statkpis span">
          <div>
            <dt>Contra octubre</dt>
            <dd className="tab" style={{ color: vsOct > 0 ? 'var(--over)' : 'var(--hue)' }}>
              {vsOct > 0 ? '+' : '−'}
              {Math.abs(vsOct)} %
            </dd>
            <small>proyección del mes</small>
          </div>
          <div>
            <dt>Por día</dt>
            <dd className="tab">{formatMoney(Math.round(spent / today.day / 100) * 100)}</dd>
            <small>promedio de noviembre</small>
          </div>
          <div>
            <dt>Fin de mes</dt>
            <dd className="tab">{formatMoney(projectedSpend)}</dd>
            <small>a este ritmo</small>
          </div>
        </dl>
        <Donut arcs={arcs} sel={sel} setSel={setSel} />
        <div style={{ display: 'grid', gap: 16 }}>
          <MonthBars />
          <Legend arcs={arcs} sel={sel} setSel={setSel} />
        </div>
      </div>
    </>
  );
}

export default function Mix({
  theme,
  view,
  dial,
  seg,
}: {
  theme: 'light' | 'dark';
  view: MixView;
  dial: DialVariant;
  seg: string | null;
}) {
  return (
    <div className="mx" data-t={theme}>
      <Shell view={view}>
        {(view === 'home' || view === 'sheet') && <Home dial={dial} />}
        {view === 'list' && <List />}
        {view === 'stats' && <Stats seg={seg} />}
      </Shell>
      {view === 'sheet' && <Sheet />}
    </div>
  );
}
