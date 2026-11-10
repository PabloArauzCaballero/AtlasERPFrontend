/* eslint-disable @next/next/no-img-element -- es un SVG propio servido desde `public/marca`: el optimizador de imágenes no aporta nada a un vector */
import { Icon } from '@/components/atlas/Icon';

/** Lo que el ERP hace, en la voz del producto y no en la del catálogo de módulos. */
const CAPACIDADES = [
  { icon: 'account_balance', text: 'Contabilidad y cierres con doble partida' },
  { icon: 'handshake', text: 'Cartera B2B, propuestas y aprobaciones' },
  { icon: 'campaign', text: 'Campañas segmentadas y su desempeño' },
  { icon: 'verified_user', text: 'Cada acción, auditada y atribuible' },
];

/**
 * La portada del acceso: el panel de marca.
 *
 * Es EL bloque amarillo de esta pantalla (regla 1 de la identidad: uno solo), y por eso el botón
 * «Iniciar sesión» de al lado va en tinta y no en amarillo. Amarillo plano, sin degradado ni halo,
 * y todo lo que va encima en `on-brand` (tinta): sobre amarillo nunca hay texto blanco ni a media
 * opacidad. Es igual en los dos temas, porque el amarillo de marca no cambia.
 */
export function AuthPortada({ audience = 'internal' }: Readonly<{ audience?: 'internal' | 'merchant' }>) {
  return (
    <aside className="hidden bg-brand px-12 py-14 text-on-brand lg:flex lg:flex-col lg:justify-between">
      {/* El SVG trae su propio margen (117 de 760): el `-ml-7` lo alinea con el texto de abajo. */}
      <img src="/marca/cuotea-logo-amarillo.svg" alt="Cuotea" width={190} height={80} className="-ml-7 h-20 w-auto self-start" />

      <div className="max-w-md">
        <h2 className="text-[2rem] font-semibold leading-[1.15] tracking-tight">
          La operación de tu negocio, con cada número explicable.
        </h2>
        <p className="mt-4 text-base leading-6">
          Contabilidad, cartera y publicidad sobre una sola fuente de verdad.
        </p>

        <ul className="mt-9 space-y-3.5">
          {CAPACIDADES.map((item) => (
            <li key={item.text} className="flex items-center gap-3 text-sm">
              <Icon name={item.icon} className="shrink-0 text-[20px]" />
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs">
        {audience === 'merchant' ? 'Acceso para comercios afiliados' : 'Acceso únicamente para personal autorizado'} ·
        Todas las acciones son auditadas
      </p>
    </aside>
  );
}
