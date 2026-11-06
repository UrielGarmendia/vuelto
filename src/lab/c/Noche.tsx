import { ChartPie, Delete, House, Plus, ReceiptText, Search, Settings } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import {
  accounts,
  available,
  balances,
  budget,
  cardDebt,
  categories,
  daily,
  earned,
  insight,
  overBudget,
  recent,
  spent,
  today,
} from '../data';
import { Odometer } from '../Odometer';
import { Glyph } from '../Glyph';
import { keyLabel, keys, sheetCategories, useEntry, signed } from '../shared';
import './noche.css';

const nav = [
  { label: 'Inicio', icon: House, current: true },
  { label: 'Movimientos', icon: ReceiptText },
  { label: 'Estadísticas', icon: ChartPie },
  { label: 'Ajustes', icon: Settings },
];

/**
 * One tick per day of the month around a 240° arc. Past days light up in order: celeste
 * when that day's spending stayed within the daily budget, amber when it went over.
 */
function MonthDial() {
  const n = today.daysInMonth;
  const cx = 170;
  const cy = 170;
  const ticks = Array.from({ length: n }, (_, i) => {
    const day = i + 1;
    const a = ((-210 + (240 * i) / (n - 1)) * Math.PI) / 180;
    const r1 = 128;
    const r2 = day <= today.day ? 156 : 146;
    const over = daily[i]! > budget / n;
    const color = day > today.day ? 'var(--idle-tick)' : over ? 'var(--over)' : 'var(--hue)';
    return (
      <line
        key={day}
        className="nc-tick"
        x1={cx + r1 * Math.cos(a)}
        y1={cy + r1 * Math.sin(a)}
        x2={cx + r2 * Math.cos(a)}
        y2={cy + r2 * Math.sin(a)}
        stroke={color}
        style={{ animationDelay: `${i * 28}ms` }}
      />
    );
  });
  return (
    <div className="nc-dial">
      <svg
        viewBox="0 0 340 300"
        role="img"
        aria-label={`Día ${today.day} de ${n}. Gastaste ${formatMoney(spent)} de ${formatMoney(budget)}.`}
      >
        {ticks}
      </svg>
      <div className="nc-center">
        <span className="big wide">{Math.round((spent / budget) * 100)} %</span>
        <p className="of">del presupuesto</p>
      </div>
      <p className="nc-spent">
        Gastaste <b className="tab">{formatMoney(spent)}</b> de {formatMoney(budget)}
      </p>
      <p className="nc-key">
        <span>
          <i style={{ background: 'var(--hue)' }} />
          día dentro del presupuesto diario
        </span>
        <span>
          <i style={{ background: 'var(--over)' }} />
          día pasado
        </span>
      </p>
    </div>
  );
}

function Home() {
  return (
    <div className="nc-app">
      <nav className="nc-side" aria-label="Principal">
        <span className="nc-word">vuelto</span>
        {nav.map(({ label, icon: Icon, current }) => (
          <a key={label} href="#" aria-current={current ? 'page' : undefined}>
            <Icon aria-hidden size={16} /> {label}
          </a>
        ))}
      </nav>
      <div className="nc-bar">
        <span className="nc-word">vuelto</span>
        <span className="nc-search">
          <Search aria-hidden size={16} /> Buscar movimientos
        </span>
        <button type="button" className="nc-pill">
          <Plus aria-hidden size={16} /> Cargar
        </button>
      </div>
      <header className="nc-title">
        <h1>Noviembre</h1>
        <p>
          A este ritmo te pasás <b className="tab">{formatMoney(overBudget)}</b> del presupuesto.
          Faltan {today.daysInMonth - today.day} días.
        </p>
      </header>
      <div className="nc-grid">
        <section className="nc-card" aria-label="Cómo viene el mes">
          <MonthDial />
        </section>

        <section className="nc-card nc-avail" aria-labelledby="nc-av">
          <p id="nc-av" className="label">
            Disponible
          </p>
          <Odometer cents={available} className="big wide" />
          <dl className="nc-kpis">
            <div>
              <dt>Entró</dt>
              <dd className="tab">{formatMoney(earned)}</dd>
            </div>
            <div>
              <dt>Salió</dt>
              <dd className="tab">{formatMoney(spent)}</dd>
            </div>
            <div>
              <dt>Debés en la Visa</dt>
              <dd className="tab">{formatMoney(cardDebt)}</dd>
            </div>
          </dl>
          <p className="nc-insight">
            Comida afuera va{' '}
            <b className="tab" style={{ color: 'var(--over)' }}>
              +{insight.pct} %
            </b>{' '}
            contra octubre: {formatMoney(insight.now)} frente a {formatMoney(insight.before)}.
          </p>
        </section>

        <section className="nc-card" aria-labelledby="nc-acc">
          <div className="head">
            <h2 id="nc-acc">Cuentas</h2>
            <span>4 cuentas</span>
          </div>
          <ul className="nc-list">
            {accounts.map((a) => (
              <li key={a.id} className="nc-row">
                <span className="t">
                  <b>{a.name}</b>
                  {a.kind === 'credit' && <span>Cierra el 28</span>}
                </span>
                <span className="v tab">{signed(balances[a.id]!)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="nc-card" aria-labelledby="nc-rec">
          <div className="head">
            <h2 id="nc-rec">Últimos movimientos</h2>
            <span>Ver todos</span>
          </div>
          <ul className="nc-list">
            {recent.map((t, i) => {
              const c = categories[t.cat]!;
              return (
                <li key={i} className="nc-row">
                  <span className="nc-ico" style={{ color: c.color }}>
                    <Glyph icon={c.icon} />
                  </span>
                  <span className="t">
                    <b>{t.note}</b>
                    <span>{c.name}</span>
                  </span>
                  <span
                    className="v tab"
                    style={t.kind === 'income' ? { color: 'var(--positive)' } : undefined}
                  >
                    {t.kind === 'income' ? '+' : '−'}
                    {formatMoney(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <nav className="nc-tabs" aria-label="Principal">
        <a className="nc-tab" href="#" aria-current="page">
          <House aria-hidden size={21} />
          Inicio
        </a>
        <a className="nc-tab" href="#">
          <ReceiptText aria-hidden size={21} />
          Movimientos
        </a>
        <button type="button" className="nc-plus" aria-label="Cargar movimiento">
          <Plus aria-hidden size={26} />
        </button>
        <a className="nc-tab" href="#">
          <ChartPie aria-hidden size={21} />
          Estadísticas
        </a>
        <a className="nc-tab" href="#">
          <Settings aria-hidden size={21} />
          Ajustes
        </a>
      </nav>
    </div>
  );
}

function Sheet() {
  const e = useEntry();
  return (
    <>
      <div className="nc-scrim" />
      <div className="nc-sheet" role="dialog" aria-label="Nuevo movimiento">
        <div className="nc-grip" />
        <div className="row">
          <div className="nc-seg" role="radiogroup" aria-label="Tipo">
            <button type="button" role="radio" aria-checked="true">
              Gasto
            </button>
            <button type="button" role="radio" aria-checked="false">
              Ingreso
            </button>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>Hoy</span>
        </div>
        <p className="nc-entry wide" aria-live="polite">
          <small>$</small>
          {e.display}
        </p>
        <div className="nc-cats" role="radiogroup" aria-label="Categoría">
          {sheetCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={e.cat === c.id}
              onClick={() => e.setCat(c.id)}
            >
              <span className="dot" style={{ color: c.color }}>
                <Glyph icon={c.icon} />
              </span>
              {c.name}
            </button>
          ))}
        </div>
        <div className="nc-meta">
          <span>Visa</span>
          <span>Agregar nota</span>
        </div>
        <div className="nc-keys" role="group" aria-label="Teclado numérico">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={keyLabel(k)}
              onClick={() => e.press(k)}
              className="tab"
            >
              {k === 'back' ? <Delete aria-hidden size={22} style={{ margin: '0 auto' }} /> : k}
            </button>
          ))}
        </div>
        <button type="button" className="nc-save">
          Guardar gasto
        </button>
      </div>
    </>
  );
}

export default function Noche({
  theme,
  view,
}: {
  theme: 'light' | 'dark';
  view: 'home' | 'sheet';
}) {
  return (
    <div className="nc" data-t={theme}>
      <Home />
      {view === 'sheet' && <Sheet />}
    </div>
  );
}
