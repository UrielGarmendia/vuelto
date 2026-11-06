# IOL (InvertirOnline) en Vuelto

Vuelto muestra el saldo y el portafolio de IOL en modo lectura, usando el conector MCP oficial (`https://mcp.invertironline.com`) con OAuth. No opera, no mueve dinero y no ve la contraseña del usuario.

## Cliente registrado

El cliente se registró por registro dinámico (DCR) en `https://mcp.invertironline.com/register`:

- Nombre: `Vuelto`
- `redirect_uris`:
  - `https://vuelto-gestor-gastos.vercel.app/api/iol/callback`
  - `http://localhost:3000/api/iol/callback` (para `vercel dev`)
- Cliente público (`token_endpoint_auth_method: none`) con PKCE `S256`; no hay client secret.

El `client_id` quedó en `.env.local` (ignorado por git) como `IOL_CLIENT_ID`.

## Variables de entorno en Vercel (Production)

| Variable           | Valor                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IOL_CLIENT_ID`    | El de `.env.local`.                                                                                                                                                                                                       |
| `IOL_TOKEN_KEY`    | 32 bytes aleatorios en base64. Generalo con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Usá uno distinto al de `.env.local`.** Si lo cambiás, todas las conexiones piden reconectar. |
| `GOOGLE_CLIENT_ID` | El mismo ID de cliente de Google que `VITE_GOOGLE_CLIENT_ID`.                                                                                                                                                             |

`IOL_REDIRECT_URI` solo hace falta en desarrollo (`http://localhost:3000/api/iol/callback`); en producción se usa el de Vercel por defecto.

## Cómo funciona

1. **Conectar** (`POST /api/iol/start`): exige la sesión de Google. Arma la URL de autorización de IOL con PKCE; el `code_verifier` y el `sub` de Google viajan cifrados en `state` (vencen en 10 minutos).
2. **Callback** (`GET /api/iol/callback`): canjea el código por tokens y los devuelve al navegador como un **blob sellado** (AES-256-GCM con `IOL_TOKEN_KEY`) en el fragmento de la URL, que no llega a ningún servidor.
3. El blob se guarda en la cuenta "IOL — Inversiones" (tipo inversión). Con login de Google viaja a Drive con el catálogo, así la PC también lo tiene.
4. **Lectura** (`POST /api/iol/balance` y `/api/iol/portfolio`): el servidor verifica el token de Google con Google (`tokeninfo`: emitido para nuestro client ID y sin vencer), abre el blob, exige que su `sub` sea el mismo usuario, renueva el token de IOL si hace falta (y devuelve un blob nuevo si IOL rotó el refresh token) y llama a la herramienta MCP.
5. El servidor no guarda nada. El blob vence a los 90 días; después pide reconectar.

## Seguridad

- **Allowlist** en `api/_lib/mcp.ts`: solo `get_balance`, `get_portfolio` y `get_asset_quote`. Todo lo demás (`update_access_mode`, `validate_*`, `simulate_*`, etc.) se rechaza antes de salir; lo prueba `api/_lib/iol.test.ts`.
- El cliente MCP y la allowlist viven en `api/_lib/` para reutilizarlos desde un futuro `api/agent`.
- Para ampliar la lista hace falta una función concreta y un test nuevo.

## Probar en local

1. `npm i -g vercel` y `vercel link` (una vez).
2. Completá `GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_ID` en `.env.local`.
3. `vercel dev` (puerto 3000) y entrá a `http://localhost:3000`. Recordá sumar `http://localhost:3000` a los orígenes autorizados de Google.

## Pendiente de validar con una cuenta real

La forma de las respuestas de `get_balance` y `get_portfolio` se tomó de la API pública de IOL (`cuentas[]` con `moneda` y `disponible`; `activos[]` con `titulo`, `valorizado` y `variacionDiaria`). La normalización (`src/features/iol/normalize.ts`) ignora lo que no reconoce; si la primera conexión real muestra $ 0, revisar ese archivo con la respuesta real.
