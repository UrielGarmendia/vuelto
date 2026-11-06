# Iniciar sesión con Google y sincronizar con Drive

Vuelto guarda una copia de los datos en la carpeta privada de la app en el Drive de cada usuario (`appDataFolder`). No hay servidor ni base de datos propia: el navegador habla directo con Google.

Mientras `VITE_GOOGLE_CLIENT_ID` esté vacío, la app funciona solo en el dispositivo y Ajustes explica que el inicio de sesión no está configurado.

## 1. Proyecto y API

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com) y creá un proyecto (por ejemplo, `vuelto`).
2. En **APIs y servicios → Biblioteca**, buscá **Google Drive API** y tocá **Habilitar**.

## 2. Pantalla de consentimiento (Google Auth Platform)

1. **APIs y servicios → Pantalla de consentimiento de OAuth** (o **Google Auth Platform → Branding**).
2. Tipo de usuario: **Externo**.
3. Datos de la app:
   - Nombre: `Vuelto`.
   - Email de asistencia: el tuyo.
   - Logo: `public/pwa-512x512.png` (opcional; si lo subís, Google lo revisa).
   - Página principal: `https://vuelto-gestor-gastos.vercel.app`
   - Política de privacidad: `https://vuelto-gestor-gastos.vercel.app/privacidad`
   - Dominio autorizado: `vuelto-gestor-gastos.vercel.app`
4. **Acceso a los datos → Agregar o quitar permisos**:
   - `.../auth/drive.appdata` (no es sensible: solo la carpeta de la app)
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
5. Mientras esté en modo **Prueba**, agregá tu cuenta (y las de quien quiera probar) en **Usuarios de prueba**. Los tokens de prueba vencen a los 7 días.

## 3. Cliente OAuth

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo: **Aplicación web**. Nombre: `Vuelto web`.
3. **Orígenes de JavaScript autorizados** (solo estos dos, sin barra final):
   - `https://vuelto-gestor-gastos.vercel.app`
   - `http://localhost:5173`
   - Para probar el build local también podés sumar `http://localhost:4173`.
4. **URIs de redireccionamiento**: no hacen falta (el login usa el modelo de token de Google Identity Services, en un popup).
5. Copiá el **ID de cliente** (`….apps.googleusercontent.com`). No es secreto, pero no lo commitees: va por variable de entorno.

Los previews de Vercel (`vuelto-git-….vercel.app`) no están autorizados a propósito; ahí la app oculta el login y lo explica.

## 4. Variables de entorno

- **Local:** en `.env.local` (ya está ignorado por git):

  ```
  VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
  ```

- **Vercel:** Project → Settings → Environment Variables → `VITE_GOOGLE_CLIENT_ID`, solo en **Production**. Después, redeploy.

## 5. Publicar la app (para que entren otros usuarios)

1. **Pantalla de consentimiento → Publicar app → En producción**.
2. Como `drive.appdata`, `openid`, `email` y `profile` **no son permisos sensibles**, alcanza con la **verificación de la marca**:
   - Verificá el dominio en [Google Search Console](https://search.google.com/search-console) con la cuenta dueña del proyecto (propiedad de tipo prefijo de URL `https://vuelto-gestor-gastos.vercel.app`, verificación por etiqueta HTML o archivo).
   - La página principal y `/privacidad` tienen que estar accesibles sin login (ya lo están).
   - Pedí la verificación de la marca desde **Google Auth Platform → Centro de verificación**. Suele tardar entre 2 y 3 días hábiles.
3. Hasta que se apruebe, la app funciona igual para los usuarios de prueba.

## Cómo funciona

- **Login:** Google Identity Services, token de acceso de aproximadamente una hora. Se guarda con su vencimiento; cuando vence, aparece un botón discreto **Reconectar con Google** (pedir un token nuevo necesita un toque, por la política de popups del navegador).
- **Archivos:** `vuelto-catalog.json` (categorías, cuentas, presupuestos, recurrentes, metas y favoritos) y un `vuelto-tx-AAAA.json` por año de movimientos. Cada sincronización sube solo los archivos que cambiaron.
- **Merge:** por `id`, gana el último `updatedAt` (los borrados también son cambios). Es idempotente, conmutativo y asociativo (`src/features/sync/merge.ts` y sus tests), así que los dispositivos convergen en cualquier orden.
- **Concurrencia:** Drive v3 no ofrece escritura condicional, así que se usa el número de `version` del archivo: se lee, se mergea, se vuelve a consultar la versión y, si otro dispositivo escribió en el medio, se repite. Una carrera nunca pierde datos: el próximo sync converge.
- **Cuándo sincroniza:** al abrir, al volver la conexión, al volver la app al frente y unos segundos después de cada cambio.
- **Primer ingreso en otro dispositivo:** las categorías y cuentas por defecto que no se tocaron ni se usaron se descartan si Drive ya las tiene con el mismo nombre.
