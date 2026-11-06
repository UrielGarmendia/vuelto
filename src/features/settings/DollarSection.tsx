import { usePrefs } from '../../app/prefs';
import { formatMoney } from '../../lib/money';
import { rateLabels, useRates, type RateKind } from '../currency/rates';

const ago = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

function since(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return ago.format(-min, 'minute');
  const h = Math.round(min / 60);
  return h < 48 ? ago.format(-h, 'hour') : ago.format(-Math.round(h / 24), 'day');
}

/** Which dollar converts USD accounts and movements into pesos. */
export function DollarSection() {
  const kind = usePrefs((s) => s.rateKind);
  const setKind = usePrefs((s) => s.setRateKind);
  const rates = useRates();
  return (
    <div className="p-3">
      <div
        role="radiogroup"
        aria-label="Cotización"
        className="well grid grid-cols-3 gap-1 rounded-[18px] p-[5px]"
      >
        {(Object.keys(rateLabels) as RateKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`grid min-h-14 content-center rounded-[14px] text-[14px] text-muted aria-checked:text-ink ${kind === k ? 'rel' : ''}`}
          >
            <span className="font-semibold">{rateLabels[k]}</span>
            <span className="tabular text-[12.5px]">
              {rates?.values[k] ? formatMoney(Math.round(rates.values[k] * 100)) : '—'}
            </span>
          </button>
        ))}
      </div>
      <p className="px-1 pt-3 text-[13px] leading-snug text-faint">
        {rates
          ? `Precio de venta, actualizado ${since(rates.fetchedAt)}. Sin conexión se usa la última cotización.`
          : rates === null
            ? 'Todavía no hay cotización: hace falta conexión una vez.'
            : '…'}{' '}
        Cada movimiento en dólares guarda la cotización del día en que lo cargaste.
      </p>
    </div>
  );
}
