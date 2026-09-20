import { Icon } from '@/components/atlas/Icon';

/** Lo que el ERP hace, en la voz del producto y no en la del catálogo de módulos. */
const CAPACIDADES = [
  { icon: 'account_balance', text: 'Contabilidad y cierres con doble partida' },
  { icon: 'handshake', text: 'Cartera B2B, propuestas y aprobaciones' },
  { icon: 'campaign', text: 'Campañas segmentadas y su desempeño' },
  { icon: 'verified_user', text: 'Cada acción, auditada y atribuible' },
];

/**
 * La portada.
 *
 * Fondo oscuro y una sola idea grande. El degradado es adorno —no señal—, así que va en tonos del
 * propio acento en vez de traer un color nuevo que compita con los estados del producto.
 */
export function AuthPortada() {
  return (
    /*
     * La losa es verde ATLAS, no un carbón con dos manchas encima.
     *
     * Era `slate-900` —un gris azulado— con el acento aplicado como dos radiales al 50% de
     * opacidad: mezclados sobre ese gris, el verde no llegaba a leerse como color de marca y la
     * mitad izquierda del acceso quedaba de un carbón sucio que no aparece en ninguna otra
     * pantalla del producto. Es la misma malla que ya usa el portal interno —el degradado va de
     * un casi negro al verde profundo—, así que las dos aplicaciones abren igual.
     */
    <aside className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#12181a_0%,#10322f_48%,#00544d_100%)] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Un halo del acento en la esquina baja, que es lo que le da profundidad a la losa sin
          volver a lavar el color con una capa a media opacidad por encima. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#006a61]/25 blur-3xl"
      />

      <div className="relative flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-sm bg-white/10 text-sm font-black backdrop-blur">
          A
        </span>
        <div>
          <p className="text-sm font-bold leading-tight">ATLAS</p>
          <p className="text-xs text-white/75">Enterprise Hub</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-[2rem] font-bold leading-[1.15] tracking-tight">
          La operación de tu negocio, con cada número explicable.
        </h2>
        <p className="mt-4 text-sm leading-6 text-white/85">
          Contabilidad, cartera y publicidad sobre una sola fuente de verdad.
        </p>

        <ul className="mt-9 space-y-3.5">
          {CAPACIDADES.map((item) => (
            <li key={item.text} className="flex items-center gap-3 text-sm text-white/90">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xs bg-white/10">
                <Icon name={item.icon} className="text-[16px]" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      {/* Al 45% este aviso no se leía sobre la losa: es texto legal, no un adorno. */}
      <p className="relative text-xs text-white/70">
        Acceso únicamente para personal autorizado · Todas las acciones son auditadas
      </p>
    </aside>
  );
}
