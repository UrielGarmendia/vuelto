import { Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { db } from '../../db/db';
import { todayISO } from '../../lib/dates';
import { Sheet, SheetDragZone } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import {
  BackupError,
  deleteAll,
  download,
  exportBackup,
  parseBackup,
  restoreBackup,
  transactionsCsv,
  type Backup,
} from './backup';

const CONFIRM_WORD = 'BORRAR';

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: typeof Download;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2 ${
        danger ? 'text-expense' : ''
      }`}
    >
      <Icon aria-hidden className={`size-5 shrink-0 ${danger ? '' : 'text-muted'}`} />
      <span className="flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}

function ConfirmSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title}>
      <div className="flex flex-col gap-4 px-5 pt-1 pb-4">
        <SheetDragZone>
          <h2 className="text-lg font-semibold">{title}</h2>
        </SheetDragZone>
        {children}
      </div>
    </Sheet>
  );
}

export function BackupSection() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportJson() {
    const backup = await exportBackup();
    download(`vuelto-backup-${todayISO()}.json`, JSON.stringify(backup), 'application/json');
  }

  async function exportCsv() {
    const [txs, cats, accs] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(),
      db.categories.toArray(),
      db.accounts.toArray(),
    ]);
    const csv = transactionsCsv(txs, {
      categories: new Map(cats.map((c) => [c.id, c.name])),
      accounts: new Map(accs.map((a) => [a.id, a.name])),
    });
    download(`vuelto-movimientos-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      setPending(parseBackup(JSON.parse(await file.text())));
    } catch (err) {
      toast(err instanceof BackupError ? err.message : 'El archivo no es un JSON válido.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending);
      // Remembered picks may point to ids that no longer exist.
      localStorage.removeItem('vuelto-last-used');
      setPending(null);
      toast('Backup restaurado');
    } catch (err) {
      console.error(err);
      toast('No se pudo restaurar. Tus datos quedaron como estaban.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmWipe() {
    setBusy(true);
    try {
      await deleteAll();
      localStorage.removeItem('vuelto-last-used');
      // Fresh start: every live query re-subscribes to the re-seeded database.
      location.assign('/');
    } catch (err) {
      console.error(err);
      setBusy(false);
      toast('No se pudo borrar. Probá de nuevo.');
    }
  }

  const counts = pending && {
    tx: pending.tables.transactions.filter((t) => !t.deleted).length,
    accounts: pending.tables.accounts.length,
    categories: pending.tables.categories.length,
    date: new Date(pending.exportedAt).toLocaleDateString('es-AR'),
  };

  return (
    <>
      <div className="divide-y divide-line">
        <Row
          icon={Download}
          label="Exportar backup"
          hint="Todo en un archivo JSON"
          onClick={() => void exportJson()}
        />
        <Row
          icon={Upload}
          label="Restaurar backup"
          hint="Reemplaza tus datos por los del archivo"
          onClick={() => fileInput.current?.click()}
        />
        <Row
          icon={FileSpreadsheet}
          label="Exportar movimientos"
          hint="CSV para Excel o Google Sheets"
          onClick={() => void exportCsv()}
        />
        <Row icon={Trash2} label="Borrar todo" danger onClick={() => setWipeOpen(true)} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="Archivo de backup"
        className="hidden"
        onChange={(e) => void pickFile(e.target.files?.[0])}
      />

      <ConfirmSheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="¿Restaurar este backup?"
      >
        {counts && (
          <p className="text-[15px] leading-relaxed text-muted">
            Backup del {counts.date}: {counts.tx} movimientos, {counts.accounts} cuentas y{' '}
            {counts.categories} categorías.{' '}
            <strong className="font-semibold text-ink">
              Reemplaza todo lo que tenés ahora en este dispositivo.
            </strong>
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void confirmRestore()}
          className="min-h-12 rounded-md bg-accent-ink font-semibold text-on-accent disabled:opacity-40"
        >
          Restaurar
        </button>
      </ConfirmSheet>

      <ConfirmSheet
        open={wipeOpen}
        onClose={() => {
          setWipeOpen(false);
          setTyped('');
        }}
        title="¿Borrar todos tus datos?"
      >
        <p className="text-[15px] leading-relaxed text-muted">
          Se borran movimientos, cuentas y categorías de este dispositivo, y no se puede deshacer.
          Si querés guardarlos, exportá un backup antes.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">
            Escribí {CONFIRM_WORD} para confirmar
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            className="min-h-12 w-full rounded-sm bg-surface-2 px-4 text-[16px] focus-visible:outline-2 focus-visible:outline-accent-ink"
          />
        </label>
        <button
          type="button"
          disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
          onClick={() => void confirmWipe()}
          className="min-h-12 rounded-md bg-expense font-semibold text-white disabled:opacity-40 dark:text-bg"
        >
          Borrar todo
        </button>
      </ConfirmSheet>
    </>
  );
}
