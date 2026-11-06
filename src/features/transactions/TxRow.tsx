import { Pencil, Trash2 } from 'lucide-react';
import {
  animate,
  m,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'motion/react';
import { memo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Account, Category, Transaction } from '../../db/types';
import { formatMoney } from '../../lib/money';
import { CategoryIcon } from '../../ui/CategoryIcon';
import { spring } from '../../ui/motion';
import { viewTransitions } from '../../app/viewTransitions';

const THRESHOLD = 96;

interface Props {
  tx: Transaction;
  category?: Category;
  account?: Account;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

/** Memoized: the virtual list re-renders on every scroll frame. */
export const TxRow = memo(function TxRow({ tx, category, account, onDelete, onEdit }: Props) {
  const x = useMotionValue(0);
  // Action backgrounds only exist while swiping, keeping idle rows cheap.
  const [swiping, setSwiping] = useState(false);
  // Swiping must not also navigate to the detail.
  const dragged = useRef(false);

  async function onDragEnd(_: unknown, info: PanInfo) {
    const dx = info.offset.x;
    if (dx < -THRESHOLD || info.velocity.x < -800) {
      navigator.vibrate?.(10);
      await animate(x, -window.innerWidth, { duration: 0.2, ease: [0.4, 0, 1, 1] });
      onDelete(tx.id);
    } else {
      if (dx > THRESHOLD) {
        navigator.vibrate?.(10);
        onEdit(tx.id);
      }
      await animate(x, 0, spring.snappy);
      setSwiping(false);
    }
  }

  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '';
  const color = tx.type === 'income' ? 'text-income' : tx.type === 'expense' ? 'text-expense' : '';

  return (
    <div className="relative overflow-hidden">
      {swiping && <SwipeActions x={x} />}
      <m.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        style={{ x, touchAction: 'pan-y' }}
        onDragStart={() => {
          dragged.current = true;
          setSwiping(true);
        }}
        onDragEnd={onDragEnd}
        className="relative bg-bg"
      >
        <Link
          to={`/movimientos/${tx.id}`}
          viewTransition={viewTransitions}
          draggable={false}
          onPointerDown={() => (dragged.current = false)}
          onClick={(e) => dragged.current && e.preventDefault()}
          className="flex min-h-[68px] items-center gap-3 px-5 py-2.5 select-none active:bg-surface-2"
        >
          <CategoryIcon icon={category?.icon} color={category?.color} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">
              {category?.name ?? 'Sin categoría'}
            </span>
            <span className="block truncate text-[13px] text-muted">
              {tx.note || account?.name}
            </span>
          </span>
          <span
            className={`tabular text-[15px] font-semibold ${color}`}
            style={{ viewTransitionName: `amount-${tx.id}` }}
          >
            {sign}
            {formatMoney(tx.amountCents, tx.currency)}
          </span>
        </Link>
      </m.div>
    </div>
  );
});

function SwipeActions({ x }: { x: MotionValue<number> }) {
  const deleteOpacity = useTransform(x, [-THRESHOLD, -24], [1, 0]);
  const editOpacity = useTransform(x, [24, THRESHOLD], [0, 1]);
  const deleteScale = useTransform(x, [-THRESHOLD * 1.4, -THRESHOLD, -24], [1.15, 1, 0.7]);
  const editScale = useTransform(x, [24, THRESHOLD, THRESHOLD * 1.4], [0.7, 1, 1.15]);
  return (
    <>
      <m.div
        aria-hidden
        style={{ opacity: editOpacity }}
        className="absolute inset-0 flex items-center bg-accent pl-6 text-on-accent"
      >
        <m.span style={{ scale: editScale }}>
          <Pencil className="size-5" />
        </m.span>
      </m.div>
      <m.div
        aria-hidden
        style={{ opacity: deleteOpacity }}
        className="absolute inset-0 flex items-center justify-end bg-expense pr-6 text-white dark:text-bg"
      >
        <m.span style={{ scale: deleteScale }}>
          <Trash2 className="size-5" />
        </m.span>
      </m.div>
    </>
  );
}
