/**
 * De qué sucursal y caja salió una compra o un pago, siempre igual en todo el portal del comercio.
 *
 * Pablo (2026-10-08): «pueden haber dos montos iguales pero de cajas distintas». Por eso la caja va SIEMPRE, también
 * cuando no tiene alias (se muestra su número de serie), y si la compra no nació de un QR físico se dice con palabras
 * en vez de dejar el hueco.
 */
import { Icon } from './Icon';

export interface Origen {
  branchName?: string | null;
  terminalAlias?: string | null;
  terminalSerial?: string | null;
}

/** «Caja 1», o la serie si la caja no tiene nombre, o null si no hay caja. */
export function nombreDeCaja(origen: Origen): string | null {
  return origen.terminalAlias?.trim() || (origen.terminalSerial ? `Caja ${origen.terminalSerial}` : null);
}

/** «Equipetrol · Caja 1» en una línea, para tablas y PDF. */
export function textoDeOrigen(origen: Origen): string {
  const caja = nombreDeCaja(origen);
  if (!origen.branchName && !caja) return 'Sin caja registrada';
  return [origen.branchName, caja].filter(Boolean).join(' · ');
}

export function OrigenDeCaja({ origen, className = '' }: Readonly<{ origen: Origen; className?: string }>) {
  const caja = nombreDeCaja(origen);
  if (!origen.branchName && !caja) {
    return <p className={`mt-1 text-xs italic text-slate-500 ${className}`}>Sin caja registrada en la compra</p>;
  }
  return (
    <p className={`mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-700 ${className}`} data-testid="origen-de-caja">
      <Icon name="store" className="text-[14px] text-primary" />
      <span>{origen.branchName ?? 'Sucursal sin nombre'}</span>
      {caja ? (
        <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-slate-700">{caja}</span>
      ) : null}
    </p>
  );
}
