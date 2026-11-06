import { createBrowserRouter } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { Layout, RequireOnboarded, Root } from './Layout';

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        path: 'privacidad',
        lazy: () =>
          import('../features/privacy/PrivacyPage').then((m) => ({ Component: m.PrivacyPage })),
      },
      {
        path: 'bienvenida',
        lazy: () =>
          import('../features/onboarding/OnboardingPage').then((m) => ({
            Component: m.OnboardingPage,
          })),
      },
      {
        element: (
          <RequireOnboarded>
            <Layout />
          </RequireOnboarded>
        ),
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
            lazy: () =>
              import('../features/stats/StatsPage').then((m) => ({ Component: m.StatsPage })),
          },
          {
            path: 'ajustes',
            lazy: () =>
              import('../features/settings/SettingsPage').then((m) => ({
                Component: m.SettingsPage,
              })),
          },
          {
            path: 'ajustes/categorias',
            lazy: () =>
              import('../features/categories/CategoriesPage').then((m) => ({
                Component: m.CategoriesPage,
              })),
          },
          {
            path: 'ajustes/cuentas',
            lazy: () =>
              import('../features/accounts/AccountsPage').then((m) => ({
                Component: m.AccountsPage,
              })),
          },
          {
            path: 'ajustes/presupuestos',
            lazy: () =>
              import('../features/budgets/BudgetsPage').then((m) => ({
                Component: m.BudgetsPage,
              })),
          },
          {
            path: 'ajustes/recurrentes',
            lazy: () =>
              import('../features/transactions/RepeatsPage').then((m) => ({
                Component: m.RepeatsPage,
              })),
          },
          { path: '*', element: <HomePage /> },
        ],
      },
    ],
  },
]);
