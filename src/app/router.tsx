import { createBrowserRouter } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StatsPage } from '../features/stats/StatsPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { Layout } from './Layout';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'movimientos', element: <TransactionsPage /> },
      { path: 'estadisticas', element: <StatsPage /> },
      { path: 'ajustes', element: <SettingsPage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
]);
