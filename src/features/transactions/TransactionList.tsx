import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { m } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Account, Category, Transaction } from '../../db/types';
import { formatDay } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { spring, staggerMs } from '../../ui/motion';
import { deleteTx, editTx } from './actions';
import { groupByDay } from './queries';
import { TxRow } from './TxRow';

// Entrance stagger plays once per app session, not on every tab switch.
let hasStaggered = false;

interface Props {
  transactions: Transaction[];
  categories: Map<string, Category>;
  accounts: Map<string, Account>;
  currentId?: string;
  onOpen?: (id: string) => void;
}

export function TransactionList({ transactions, categories, accounts, currentId, onOpen }: Props) {
  const rows = useMemo(() => groupByDay(transactions), [transactions]);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [mountedAt] = useState(Date.now);
  const [stagger] = useState(() => !hasStaggered);
  // Glide rows only right after the data changes; during scrolling, size corrections snap.
  const [prevRows, setPrevRows] = useState(rows);
  const [gliding, setGliding] = useState(false);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setGliding(true);
  }
  useEffect(() => {
    if (!gliding) return;
    const t = setTimeout(() => setGliding(false), 600);
    return () => clearTimeout(t);
  }, [gliding, rows]);

  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
    hasStaggered = true;
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]?.kind === 'day' ? 46 : 66),
    getItemKey: (i) => rows[i]!.key,
    overscan: 5,
    scrollMargin,
  });

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index]!;
        const isNew = row.kind === 'tx' && row.tx.updatedAt > mountedAt;
        const enter = isNew || (stagger && item.index < 14);
        return (
          <m.div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0"
            // Animating `y` lets the rest of the list glide when a row is added or removed.
            initial={
              enter ? { opacity: 0, y: item.start - scrollMargin + (isNew ? -8 : 8) } : false
            }
            animate={{ opacity: 1, y: item.start - scrollMargin }}
            transition={
              enter || gliding
                ? {
                    ...spring.snappy,
                    delay: !isNew && stagger ? (item.index * staggerMs) / 1000 : 0,
                  }
                : { duration: 0 }
            }
          >
            {row.kind === 'day' ? (
              <div className="flex items-end justify-between px-1 pt-5 pb-2">
                <h2 className="text-[13px] font-semibold text-muted">{formatDay(row.date)}</h2>
                <span className="tabular text-[13px] font-semibold text-muted">
                  {row.totalCents > 0 ? '+' : row.totalCents < 0 ? '−' : ''}
                  {formatMoney(Math.abs(row.totalCents))}
                </span>
              </div>
            ) : (
              <TxRow
                tx={row.tx}
                category={row.tx.categoryId ? categories.get(row.tx.categoryId) : undefined}
                account={accounts.get(row.tx.accountId)}
                toAccount={row.tx.toAccountId ? accounts.get(row.tx.toAccountId) : undefined}
                onDelete={deleteTx}
                onEdit={editTx}
                first={rows[item.index - 1]?.kind !== 'tx'}
                last={rows[item.index + 1]?.kind !== 'tx'}
                current={row.tx.id === currentId}
                onOpen={onOpen}
              />
            )}
          </m.div>
        );
      })}
    </div>
  );
}
