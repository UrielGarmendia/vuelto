import { ChartPie } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';

export function StatsPage() {
  return (
    <>
      <PageHeader title="Estadísticas" />
      <EmptyState icon={ChartPie} title="Faltan datos para mostrar">
        Con unos días de movimientos vas a ver en qué se te va la plata.
      </EmptyState>
    </>
  );
}
