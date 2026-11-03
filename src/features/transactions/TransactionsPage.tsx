import { ReceiptText } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';

export function TransactionsPage() {
  return (
    <>
      <PageHeader title="Movimientos" />
      <EmptyState icon={ReceiptText} title="Todavía no hay movimientos">
        Cada gasto e ingreso que cargues va a aparecer acá, agrupado por día.
      </EmptyState>
    </>
  );
}
