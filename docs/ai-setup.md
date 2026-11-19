# Copiloto, tickets e IA opcional

El copiloto («Contale a Vuelto») y la lectura de tickets funcionan **gratis y en el dispositivo**, sin servidor y sin conexión:

- **Copiloto:** un parser de montos (`src/features/copilot/amount.ts`), las reglas del usuario y un diccionario argentino (`src/features/copilot/dictionary.ts`) arman tarjetas editables. Nada se guarda sin confirmar.
- **Tickets:** Tesseract.js en español, cargado aparte solo al usar la cámara, más heurísticas para total, fecha, comercio y medio de pago (`src/features/receipt/`).
  - La primera lectura descarga el lector y los datos del español desde la propia app (`/tesseract/`, unos 6 MB); después quedan en caché. Ningún CDN de terceros.

La IA es un **extra opcional**: si está configurada y tu email habilitado, aparece «Mejorar con IA» solo cuando la lectura local deja algo sin resolver o con baja confianza. En el ticket, aparece cuando la lectura local falla. Sin configurarla, no aparece nada de IA y todo funciona igual.

## Variables en Vercel (Production)

| Variable              | Obligatoria | Para qué                                                                                                          |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Sí          | Clave de la API de Anthropic. Solo en Vercel, nunca en el código ni en `.env` commiteado.                         |
| `ALLOWED_AI_EMAILS`   | Sí          | Emails de Google habilitados, separados por coma (por ejemplo `vos@gmail.com`). Cualquier otro email no ve la IA. |
| `COPILOT_DAILY_LIMIT` | No          | Usos por persona y por día (hora de Argentina). Por defecto 30, máximo 1000.                                      |
| `COPILOT_MODEL`       | No          | Modelo a usar. Por defecto `claude-haiku-5-5` (Claude Haiku 5.5, el rápido y económico).                          |

También hacen falta las que ya usa IOL: `GOOGLE_CLIENT_ID` (para saber quién llama) y `IOL_TOKEN_KEY`, que además sella el contador diario.

Después de cargarlas, hacé un redeploy. En la app, Ajustes → sesión de Google: si tu email está habilitado, el copiloto muestra «Mejorar con IA» cuando corresponde.

## Tope de gasto

1. En la consola de Anthropic (Settings → Limits), poné un **límite de gasto mensual**. Es el tope real.
2. `COPILOT_DAILY_LIMIT` limita los usos por persona, pero el contador viaja **sellado con el cliente** (`api/_lib/quota.ts`, `SealedQuota`). No se puede leer ni falsificar, pero quien borre los datos del navegador empieza de nuevo en cero. Alcanza mientras solo entren emails de `ALLOWED_AI_EMAILS`.

**Cuando la IA se habilite para otros usuarios, hay que migrar el límite a Upstash Redis.** El límite está detrás de la interfaz `QuotaStore` (`consume` y `peek`): alcanza con escribir una implementación con un contador en Redis por usuario y día, y usarla en `aiSetup` (`api/_lib/ai.ts`). Nada más cambia.

## Cuánto cuesta (aproximado)

Los números son **aproximados**: verificá los precios vigentes en la página de precios de Anthropic, https://platform.claude.com/docs/en/about-claude/pricing.

Con Claude Haiku 5.5 (US$ 0,10 por millón de tokens de entrada y US$ 0,50 por millón de salida):

| Uso                    | Tokens aproximados                                                      | Costo aproximado |
| ---------------------- | ----------------------------------------------------------------------- | ---------------- |
| «Mejorar con IA» texto | ~1.200 de entrada (instrucciones + catálogo + mensaje) y ~500 de salida | ~US$ 0,0004      |
| Ticket con IA          | ~3.000 de entrada (la foto de 1600 px + texto) y ~500 de salida         | ~US$ 0,0006      |

Con el límite por defecto (30 usos por día), el peor caso de una persona es de unos US$ 0,55 por mes. Con otro modelo en `COPILOT_MODEL`, el costo cambia según su precio.

## Qué se envía y qué no

- **Qué se envía:** solo lo que el dispositivo no pudo resolver (ese pedazo de texto o esa foto), la fecha de hoy y los nombres de tus categorías, cuentas y reglas. No se envían montos de cuentas, movimientos ni nada de IOL.
- **Qué se guarda:** la función (`api/ai/copilot.ts`, `api/ai/receipt.ts`) no guarda ni registra el texto ni la imagen. Los logs solo dicen si la llamada falló.
- **Cómo se trata la respuesta:** lo que devuelve el modelo es un dato, no una instrucción. Se valida con un esquema, cada id se contrasta con el catálogo enviado, las fechas futuras pasan a hoy, las cuotas solo valen en tarjeta y lo dudoso vuelve con confianza baja (en ámbar).

## Probar en local

`vercel dev` con las variables en `.env.local` (ignorado por git). Sin `ANTHROPIC_API_KEY`, `/api/ai/status` responde `{ "enabled": false }` y la app no muestra nada de IA.
