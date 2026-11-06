import { ChartPie, Delete, House, Plus, ReceiptText, Settings } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import {
  accounts,
  available,
  balances,
  budget,
  byCategory,
  cardDebt,
  categories,
  cumulative,
  earned,
  insight,
  overBudget,
  projectedSpend,
  recent,
  spent,
  today,
} from '../data';
import { Odometer } from '../Odometer';
import { Glyph } from '../Glyph';
import { keyLabel, keys, sheetCategories, useEntry, signed } from '../shared';
import './ticket.css';

const nav = [
  { label: 'Inicio', icon: House, current: true },
  { label: 'Movimientos', icon: ReceiptText },
  { label: 'Estadísticas', icon: ChartPie },
  { label: 'Ajustes', icon: Settings },
];

/** Cumulative spending so far (the one hue), the projection to the end, and the budget line. */
function PaceChart() {
  const W = 320;
  const H = 150;
  const top = Math.max(projectedSpend, budget) * 1.08;
  const x = (day: number) => (day / today.daysInMonth) * (W - 8);
  const y = (cents: number) => H - 22 - (cents / top) * (H - 34);
  const pts = cumulative
    .slice(0, today.day)
    .map((c, i) => `${x(i + 1).toFixed(1)},${y(c).toFixed(1)}`);
  const now = `${x(today.day)},${y(spent)}`;
  return (
    <svg
      className="tb-bars"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Gastado acumulado ${formatMoney(spent)} al día ${today.day}; proyección ${formatMoney(projectedSpend)} contra un presupuesto de ${formatMoney(budget)}`}
    >
      <line className="pace" x1={x(0)} y1={y(0)} x2={x(30)} y2={y(budget)} />
      <polyline
        points={`${x(0)},${y(0)} ${pts.join(' ')}`}
        fill="none"
        stroke="var(--hue)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line
        x1={x(today.day)}
        y1={y(spent)}
        x2={x(30)}
        y2={y(projectedSpend)}
        stroke="var(--hue)"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <circle cx={now.split(',')[0]} cy={now.split(',')[1]} r="4" fill="var(--hue)" />
      <line
        x1="4"
        y1="8"
        x2="20"
        y2="8"
        stroke="var(--hue)"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <text x="26" y="12">
        proyección {formatMoney(projectedSpend)}
      </text>
      <line className="pace" x1="4" y1="22" x2="20" y2="22" />
      <text x="26" y="26">
        presupuesto {formatMoney(budget)}
      </text>
      <text x="0" y={H - 4}>
        1 nov
      </text>
      <text x={x(today.day)} y={H - 4} textAnchor="middle">
        hoy
      </text>
      <text x={W - 4} y={H - 4} textAnchor="end">
        30 nov
      </text>
    </svg>
  );
}

function Line({ name, value, strong }: { name: string; value: string; strong?: boolean }) {
  return (
    <div className={`tb-line ${strong ? 'strong' : ''}`}>
      <span>{name}</span>
      <span className="dots" />
      <span className="v">{value}</span>
    </div>
  );
}

function Receipt() {
  const top = byCategory.slice(0, 7);
  const rest = spent - top.reduce((a, c) => a + c.cents, 0);
  return (
    <section className="tb-receipt-wrap" aria-labelledby="tb-ticket">
      <div className="tb-receipt">
        <div className="hd">
          <b id="tb-ticket">Ticket de noviembre</b>
          del 1 al {today.day}
        </div>
        <hr />
        {top.map((c) => (
          <Line key={c.cat} name={categories[c.cat]!.name} value={formatMoney(c.cents)} />
        ))}
        <Line name="Otros" value={formatMoney(rest)} />
        <hr />
        <Line name="Gastaste" value={formatMoney(spent)} strong />
        <Line name="Entró" value={formatMoney(earned)} />
        <Line name="Tu vuelto" value={formatMoney(earned - spent)} strong />
        <p className="foot">Faltan {today.daysInMonth - today.day} días</p>
      </div>
    </section>
  );
}

function Home() {
  return (
    <div className="tb-app">
      <nav className="tb-side" aria-label="Principal">
        <span className="tb-word">vuelto</span>
        {nav.map(({ label, icon: Icon, current }) => (
          <a key={label} href="#" aria-current={current ? 'page' : undefined}>
            <Icon aria-hidden size={16} /> {label}
          </a>
        ))}
      </nav>
      <div className="tb-top">
        <span className="tb-word">vuelto</span>
        <button type="button" className="tb-btn">
          <Plus aria-hidden size={16} /> Cargar gasto
        </button>
      </div>
      <header className="tb-title">
        <h1>Noviembre</h1>
        <p>
          A este ritmo terminás el mes gastando <b className="fig">{formatMoney(projectedSpend)}</b>
          , <b className="fig">{formatMoney(overBudget)}</b> más que tu presupuesto.
        </p>
      </header>

      <div className="tb-grid">
        <section className="tb-card tb-total" aria-labelledby="tb-avail">
          <p id="tb-avail" className="label">
            Disponible hoy
          </p>
          <Odometer cents={available} className="big fig" />
          <p className="sub">Más {formatMoney(cardDebt)} que debés en la Visa.</p>
          <PaceChart />
          <dl className="tb-split">
            <div>
              <dt>Gastado al día {today.day}</dt>
              <dd className="fig">{formatMoney(spent)}</dd>
            </div>
            <div>
              <dt>Comida afuera contra octubre</dt>
              <dd className="fig" style={{ color: 'var(--negative)' }}>
                ▲ {insight.pct} %
              </dd>
            </div>
          </dl>
        </section>

        <Receipt />

        <section className="tb-card" aria-labelledby="tb-acc">
          <div className="head">
            <h2 id="tb-acc">Cuentas</h2>
            <span>al {today.day} nov</span>
          </div>
          <table className="tb-table">
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="fig">{signed(balances[a.id]!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="tb-card" aria-labelledby="tb-recent">
          <div className="head">
            <h2 id="tb-recent">Últimos movimientos</h2>
            <span>Ver todos</span>
          </div>
          <table className="tb-table">
            <tbody>
              {recent.map((t, i) => {
                const c = categories[t.cat]!;
                return (
                  <tr key={i}>
                    <td>
                      <span className="tb-ico">
                        <Glyph icon={c.icon} />
                      </span>
                      {t.note}
                      <span className="sub" style={{ marginLeft: 40 }}>
                        <span className="tb-pip" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </td>
                    <td
                      className="fig"
                      style={t.kind === 'income' ? { color: 'var(--positive)' } : undefined}
                    >
                      {t.kind === 'income' ? '+' : '−'}
                      {formatMoney(t.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <nav className="tb-tabs" aria-label="Principal">
        <a className="tb-tab" href="#" aria-current="page">
          <House aria-hidden size={21} />
          Inicio
        </a>
        <a className="tb-tab" href="#">
          <ReceiptText aria-hidden size={21} />
          Movimientos
        </a>
        <button type="button" className="tb-plus" aria-label="Cargar movimiento">
          <Plus aria-hidden size={26} />
        </button>
        <a className="tb-tab" href="#">
          <ChartPie aria-hidden size={21} />
          Estadísticas
        </a>
        <a className="tb-tab" href="#">
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
      <div className="tb-scrim" />
      <div className="tb-sheet" role="dialog" aria-label="Nuevo movimiento">
        <div className="row">
          <div className="tb-seg" role="radiogroup" aria-label="Tipo">
            <button type="button" role="radio" aria-checked="true">
              Gasto
            </button>
            <button type="button" role="radio" aria-checked="false">
              Ingreso
            </button>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>{today.label}</span>
        </div>
        <p className="tb-entry" aria-live="polite">
          <small>$</small>
          {e.display}
        </p>
        <div className="tb-cats" role="radiogroup" aria-label="Categoría">
          {sheetCategories.slice(0, 6).map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={e.cat === c.id}
              onClick={() => e.setCat(c.id)}
            >
              <span className="tb-pip" style={{ background: c.color }} />
              <Glyph icon={c.icon} />
              {c.name}
            </button>
          ))}
        </div>
        <p className="tb-meta">
          <span>
            Cuenta <b>Visa</b>
          </span>
          <span>
            Fecha <b>Hoy</b>
          </span>
          <span>
            Nota <b>agregar</b>
          </span>
        </p>
        <div className="tb-keys" role="group" aria-label="Teclado numérico">
          {keys.map((k) => (
            <button key={k} type="button" aria-label={keyLabel(k)} onClick={() => e.press(k)}>
              {k === 'back' ? <Delete aria-hidden size={22} style={{ margin: '0 auto' }} /> : k}
            </button>
          ))}
        </div>
        <button type="button" className="tb-save">
          Guardar gasto
        </button>
      </div>
    </>
  );
}

export default function Ticket({
  theme,
  view,
}: {
  theme: 'light' | 'dark';
  view: 'home' | 'sheet';
}) {
  return (
    <div className="tb" data-t={theme}>
      <Home />
      {view === 'sheet' && <Sheet />}
    </div>
  );
}
