import { createBrowserRouter } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { Layout } from './Layout';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'movimientos', element: <TransactionsPage /> },
      {
        path: 'movimientos/:id',
        lazy: () =>
          import('../features/transactions/TransactionDetailPage').then((m) => ({
            Component: m.TransactionDetailPage,
          })),
      },
      {
        path: 'estadisticas',
        lazy: () => import('../features/stats/StatsPage').then((m) => ({ Component: m.StatsPage })),
      },
      {
        path: 'ajustes',
        lazy: () =>
          import('../features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
      },
      { path: '*', element: <HomePage /> },
    ],
  },
]);
