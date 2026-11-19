import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { dayChange, HISTORY_KEY, rateLabels, useRates, type RateHistory } from './rates';

const pctText = (p: number) =>
  `${p > 0 ? '▲ +' : p < 0 ? '▼ −' : ''}${Math.abs(p).toFixed(2).replace('.', ',')} %`;

/** Inicio: the MEP and blue dollar, with how much they moved since the previous day. */
export function RatesWidget() {
  // Read so the widget refreshes stale rates, which also records today's quote.
  useRates();
  const history = useLiveQuery(
    async () => ((await db.kv.get(HISTORY_KEY))?.value as RateHistory | undefined) ?? {},
  );
  if (!history) return null;
  const today = todayISO();
  const kinds = (['mep', 'blue'] as const).map((k) => ({ k, ...dayChange(history, k, today) }));
  if (kinds.every((r) => r.value === undefined)) return null;

  return (
    <section aria-labelledby="rates-label" className="rounded-[22px] bg-flat px-[18px] py-4">
      <h2 id="rates-label" className="text-[13.5px] text-muted">
        Dólar
      </h2>
      <dl className="mt-2 grid grid-cols-2 gap-3">
        {kinds.map(({ k, value, pct }) => (
          <div key={k} className="min-w-0">
            <dt className="text-[12.5px] text-faint">{rateLabels[k]}</dt>
            <dd className="tabular mt-0.5 text-[18px] font-bold">
              {value ? formatMoney(Math.round(value * 100)) : '—'}
            </dd>
            <dd className="tabular text-[12.5px] text-muted">
              {pct === undefined ? 'sin dato de ayer' : pctText(pct)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
