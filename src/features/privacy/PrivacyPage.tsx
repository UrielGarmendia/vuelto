import { Link } from 'react-router';
import { Wordmark } from '../../ui/Wordmark';

const sections: { title: string; body: string[] }[] = [
  {
    title: 'Qué se guarda en tu dispositivo',
    body: [
      'Tus movimientos, categorías, cuentas, presupuestos, recurrentes, favoritos y preferencias se guardan en el navegador de tu dispositivo (IndexedDB y localStorage). No hay un servidor de Vuelto con tus datos.',
      'Podés exportarlos o borrarlos cuando quieras desde Ajustes.',
    ],
  },
  {
    title: 'Qué va a tu Google Drive',
    body: [
      'Solo si iniciás sesión con Google. Vuelto pide un único permiso, drive.appdata: una carpeta privada de la app dentro de tu Drive, que no ves en tu lista de archivos y a la que ninguna otra app accede. Vuelto no puede ver ni tocar el resto de tu Drive.',
      'Ahí se guarda una copia de tus datos para usarlos en otros dispositivos. También se usan tu nombre, tu email y tu foto de perfil para mostrarte con qué cuenta entraste.',
      'Podés revocar el acceso en myaccount.google.com/permissions. Al cerrar sesión elegís si los datos quedan o se borran de ese dispositivo.',
    ],
  },
  {
    title: 'Qué ve IOL',
    body: [
      'Solo si conectás tu cuenta de InvertirOnline. La autorización se hace en el sitio de IOL; Vuelto nunca ve tu usuario ni tu contraseña.',
      'Vuelto pide únicamente tu saldo, tu portafolio y cotizaciones, en modo lectura. No opera ni mueve dinero. El permiso de IOL se guarda cifrado en tu dispositivo (y en tu Drive si iniciaste sesión) y se puede desconectar en cualquier momento.',
    ],
  },
  {
    title: 'Servicios de terceros',
    body: [
      'La cotización del dólar se consulta en dolarapi.com, sin enviar datos tuyos. Vuelto no usa cookies de seguimiento, publicidad ni analíticas.',
    ],
  },
];

/** Public privacy policy, linked from the Google consent screen. */
export function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-[680px] bg-ground px-5 pt-safe pb-16">
      <div className="flex h-16 items-center">
        <Link to="/" aria-label="Vuelto, ir al inicio">
          <Wordmark />
        </Link>
      </div>
      <h1 className="mt-4 text-[28px] font-bold">Privacidad</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Vuelto es una app de gastos personales que funciona en tu dispositivo. Esta página explica
        qué datos usa y dónde quedan. Última actualización: noviembre de 2026.
      </p>
      {sections.map((s) => (
        <section key={s.title} className="mt-8">
          <h2 className="text-[18px] font-semibold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p.slice(0, 24)} className="mt-3 text-[15px] leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
