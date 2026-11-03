# Vuelto

App de gastos personales pensada para el celular. Funciona offline, se instala como app (PWA) y guarda todo en el dispositivo.

> En desarrollo. Hoy está la base: navegación, tema claro/oscuro, base de datos local e instalación.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · Dexie (IndexedDB) · Zustand · Motion · React Router · vite-plugin-pwa · Vitest · Playwright

## Correrlo

```bash
npm install
npm run dev
```

| Comando             | Qué hace                                                           |
| ------------------- | ------------------------------------------------------------------ |
| `npm run build`     | Build de producción en `dist/`                                     |
| `npm run preview`   | Sirve el build (necesario para probar el service worker)           |
| `npm run typecheck` | Chequeo de tipos                                                   |
| `npm run lint`      | ESLint                                                             |
| `npm test`          | Tests unitarios                                                    |
| `npm run e2e`       | Tests end-to-end + capturas en iPhone 15, Pixel 7 y Android 360 px |

Para los e2e hace falta instalar los navegadores una vez: `npx playwright install chromium webkit`.

## Deploy

Pensado para Vercel: importar el repo, framework **Vite**, sin variables de entorno. `vercel.json` ya resuelve el fallback de rutas y el cacheo del service worker.
