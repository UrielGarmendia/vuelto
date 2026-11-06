import {
  CalendarDays,
  ChartPie,
  Delete,
  House,
  NotebookPen,
  Plus,
  ReceiptText,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { formatMoney } from '../../lib/money';
import {
  accounts,
  balances,
  budget,
  cardDebt,
  categories,
  earned,
  insight,
  overBudget,
  available,
  recent,
  spent,
  today,
} from '../data';
import { Odometer } from '../Odometer';
import { Glyph } from '../Glyph';
import { keyLabel, keys, sheetCategories, useEntry, signed } from '../shared';
import './relieve.css';

const nav = [
  { label: 'Inicio', icon: House, current: true },
  { label: 'Movimientos', icon: ReceiptText },
  { label: 'Estadísticas', icon: ChartPie },
  { label: 'Ajustes', icon: Settings },
];

function CatTile({ id }: { id: string }) {
  const c = categories[id]!;
  return (
    <span className="ra-cat raised sm" style={{ color: c.color }}>
      <Glyph icon={c.icon} />
    </span>
  );
}

function Home() {
  const pct = Math.min(1, spent / budget);
  const pace = today.day / today.daysInMonth;
  return (
    <div className="ra-app">
      <nav className="ra-side raised" aria-label="Principal">
        {nav.map(({ label, icon: Icon, current }) => (
          <a key={label} href="#" aria-current={current ? 'page' : undefined}>
            <Icon aria-hidden size={18} /> {label}
          </a>
        ))}
      </nav>
      <main>
        <header className="ra-head">
          <div>
            <h1>{today.monthName}</h1>
            <p>{today.label}</p>
          </div>
          <span className="ra-mark raised sm" aria-hidden>
            <svg viewBox="0 0 512 512" width="24" height="24">
              <path
                d="M164 176 256 344 348 176"
                fill="none"
                stroke="currentColor"
                strokeWidth="64"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </header>

        <div className="ra-grid">
          <section className="ra-hero raised" aria-labelledby="ra-avail">
            <p id="ra-avail" className="label">
              Disponible
            </p>
            <Odometer cents={available} className="big num" />
            <p className="ra-finding">
              A este ritmo te pasás <b className="num">{formatMoney(overBudget)}</b> de tu
              presupuesto de {formatMoney(budget)}.
            </p>
            <div className="ra-meter">
              <div
                className="ra-track"
                role="img"
                aria-label={`Gastaste el ${Math.round(pct * 100)} % del presupuesto; pasó el ${Math.round(pace * 100)} % del mes`}
              >
                <span className="ra-fill" style={{ width: `calc(${pct * 100}% - 6px)` }} />
                <span className="ra-pace" style={{ left: `${pace * 100}%` }} />
              </div>
              <div className="ra-meter-legend">
                <span>
                  Gastado <b className="num">{Math.round(pct * 100)} %</b>
                </span>
                <span>
                  Día {today.day} de {today.daysInMonth}
                </span>
              </div>
            </div>
          </section>

          <dl className="ra-pair">
            <div className="ra-stat raised">
              <dt>Gastaste</dt>
              <dd className="num" style={{ color: 'var(--expense)' }}>
                {formatMoney(spent)}
              </dd>
            </div>
            <div className="ra-stat raised">
              <dt>Entró</dt>
              <dd className="num" style={{ color: 'var(--income)' }}>
                {formatMoney(earned)}
              </dd>
            </div>
          </dl>

          <p className="ra-insight raised">
            <Sparkles aria-hidden size={20} style={{ color: 'var(--warn)', flexShrink: 0 }} />
            <span>
              En comida afuera vas <b className="num">+{insight.pct} %</b> frente a octubre (
              {formatMoney(insight.now)} contra {formatMoney(insight.before)}).
            </span>
          </p>

          <section className="ra-section" aria-labelledby="ra-acc">
            <h2 id="ra-acc">Cuentas</h2>
            <div className="ra-accounts">
              {accounts.map((a) => {
                const b = balances[a.id]!;
                return (
                  <div key={a.id} className="ra-acc raised">
                    <p className="name">{a.name}</p>
                    <p
                      className="value num"
                      style={b < 0 ? { color: 'var(--expense)' } : undefined}
                    >
                      {signed(b)}
                    </p>
                    {a.kind === 'credit' && <p className="note">Deuda a pagar</p>}
                  </div>
                );
              })}
            </div>
            <p className="ra-meter-legend" style={{ margin: '10px 4px 0' }}>
              <span>Incluye {formatMoney(cardDebt)} de tarjeta</span>
            </p>
          </section>

          <section className="ra-section" aria-labelledby="ra-recent">
            <h2 id="ra-recent">Últimos movimientos</h2>
            <ul className="ra-list well">
              {recent.map((t, i) => (
                <li key={i} className="ra-row">
                  <CatTile id={t.cat} />
                  <span className="t">
                    <b>{t.note}</b>
                    <span>{categories[t.cat]!.name}</span>
                  </span>
                  <span
                    className="amt num"
                    style={{ color: t.kind === 'income' ? 'var(--income)' : undefined }}
                  >
                    {t.kind === 'income' ? '+' : '−'}
                    {formatMoney(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <nav className="ra-tabs raised" aria-label="Principal">
        <a className="ra-tab" href="#" aria-current="page">
          <House aria-hidden size={22} />
          Inicio
        </a>
        <a className="ra-tab" href="#">
          <ReceiptText aria-hidden size={22} />
          Movimientos
        </a>
        <button type="button" className="ra-plus press" aria-label="Cargar movimiento">
          <Plus aria-hidden size={28} strokeWidth={2.4} />
        </button>
        <a className="ra-tab" href="#">
          <ChartPie aria-hidden size={22} />
          Estadísticas
        </a>
        <a className="ra-tab" href="#">
          <Settings aria-hidden size={22} />
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
      <div className="ra-scrim" />
      <div className="ra-sheet" role="dialog" aria-label="Nuevo movimiento">
        <div className="ra-grip" />
        <div className="ra-seg well" role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" aria-checked="true" className="press">
            Gasto
          </button>
          <button type="button" role="radio" aria-checked="false">
            Ingreso
          </button>
        </div>
        <p className="ra-amount num" aria-live="polite">
          <small>$</small>
          {e.display}
        </p>
        <div className="ra-cats" role="radiogroup" aria-label="Categoría">
          {sheetCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={e.cat === c.id}
              onClick={() => e.setCat(c.id)}
              className="press"
            >
              <span className="ra-cat" style={{ color: c.color }}>
                <Glyph icon={c.icon} />
              </span>
              {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="ra-chips">
          <span className="ra-chip well">
            <CalendarDays aria-hidden size={16} /> Hoy
          </span>
          <span className="ra-chip raised sm">
            <Wallet aria-hidden size={16} /> Visa
          </span>
          <span className="ra-chip raised sm">
            <NotebookPen aria-hidden size={16} /> Nota
          </span>
        </div>
        <div className="ra-keys" role="group" aria-label="Teclado numérico">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className="press num"
              aria-label={keyLabel(k)}
              onClick={() => e.press(k)}
            >
              {k === 'back' ? <Delete aria-hidden size={24} /> : k}
            </button>
          ))}
        </div>
        <button type="button" className="ra-save press">
          Guardar gasto
        </button>
      </div>
    </>
  );
}

export default function Relieve({
  theme,
  view,
}: {
  theme: 'light' | 'dark';
  view: 'home' | 'sheet';
}) {
  return (
    <div className="ra" data-t={theme}>
      <Home />
      {view === 'sheet' && <Sheet />}
    </div>
  );
}
