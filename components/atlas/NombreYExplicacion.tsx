/**
 * Una entrada del cajón: el nombre y, debajo, qué hace.
 *
 * Sólo el nombre no alcanzaba: «Pactar contrato» o «Enlazar expediente de Atlas» no dicen qué va a
 * pasar a quien no conoce el proceso, y la única forma de averiguarlo era pulsar.
 */
export function NombreYExplicacion({ nombre, explicacion }: { nombre: string; explicacion: string }) {
  return (
    <span className="min-w-0">
      <span className="block">{nombre}</span>
      <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-500">{explicacion}</span>
    </span>
  );
}
