import { partnerOnboardingService, type PartnerPosTerminal } from '@/services/partnerOnboardingService';

/**
 * Las cajas de una sucursal, por CANTIDAD.
 *
 * Pablo (2026-10-02): «que se pueda poner la cantidad de cajas por sucursal para generar el QR por
 * caja», con nombres «generados en base a un patrón, claro y comprensible», y lo demás (serial
 * propio, CSV) opcional. Lo normal es escribir cuántas cajas tiene el local y nada más.
 *
 * El patrón:
 *   - Nombre (alias) que ve la gente: «Caja 1», «Caja 2»… dentro de cada sucursal.
 *   - Serial, que es lo que lleva el QR: el nombre de la sucursal, un trozo de su identificador para
 *     que dos «Sucursal Norte» de comercios distintos no choquen, y el número. P. ej.
 *     `TIENDA-NORTE-1A2B3C-CAJA-1`. El serial es único en todo Atlas y sólo admite letras, dígitos y
 *     guiones; este patrón cumple ambas reglas y se lee de un vistazo en la etiqueta impresa.
 */

export const MAX_CAJAS_POR_VEZ = 50;

const PATRON_ALIAS = /^caja\s+(\d+)$/iu;

/** «Tienda Norte (Equipetrol)» → `TIENDA-NORTE-EQUIPETROL`. Sin tildes ni signos; como mucho 24 caracteres. */
export function slugDeSucursal(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return (limpio || 'SUCURSAL').slice(0, 24).replace(/-+$/u, '');
}

export function aliasDeCaja(numero: number): string {
  return `Caja ${numero}`;
}

export function serialDeCaja(nombreSucursal: string, erpBranchId: string, numero: number): string {
  const huella = erpBranchId.replace(/[^A-Za-z0-9]/gu, '').slice(0, 6).toUpperCase() || 'X';
  return `${slugDeSucursal(nombreSucursal)}-${huella}-CAJA-${numero}`;
}

/** El siguiente número libre: después del mayor «Caja N» que ya exista, o del total de cajas. */
export function siguienteNumero(existentes: readonly Pick<PartnerPosTerminal, 'terminalAlias'>[]): number {
  const numeros = existentes
    .map((pos) => PATRON_ALIAS.exec(String(pos.terminalAlias ?? '').trim())?.[1])
    .filter((valor): valor is string => Boolean(valor))
    .map(Number);
  return Math.max(existentes.length, ...numeros, 0) + 1;
}

export interface ResultadoCajas {
  creadas: number;
  /** Las que se crearon pero no se pudieron activar: su QR todavía no lo acepta el teléfono del cliente. */
  sinActivar: number;
}

/**
 * Da de alta `cantidad` cajas en la sucursal, numeradas a continuación de las que ya tiene, y las
 * ACTIVA: una caja nace `registered` y su QR no lo acepta la app del cliente hasta estar `active`,
 * así que crearlas sin activarlas dejaba al comercio con QR impresos que no sirven.
 *
 * `serialPropio` sólo se usa cuando se crea UNA caja: es la opción para quien ya tiene una terminal
 * con su número de serie.
 */
export async function crearCajas(input: {
  partnerId: string;
  branchId: string;
  erpBranchId: string;
  nombreSucursal: string;
  cantidad: number;
  existentes: readonly PartnerPosTerminal[];
  serialPropio?: string;
}): Promise<ResultadoCajas> {
  const cantidad = Math.max(0, Math.min(MAX_CAJAS_POR_VEZ, Math.trunc(input.cantidad)));
  const desde = siguienteNumero(input.existentes);
  const resultado: ResultadoCajas = { creadas: 0, sinActivar: 0 };
  for (let i = 0; i < cantidad; i += 1) {
    const numero = desde + i;
    const serial =
      cantidad === 1 && input.serialPropio?.trim()
        ? input.serialPropio.trim()
        : serialDeCaja(input.nombreSucursal, input.erpBranchId, numero);
    const caja = await partnerOnboardingService.registerPosTerminal(input.partnerId, input.branchId, {
      terminalSerial: serial,
      terminalAlias: aliasDeCaja(numero),
    });
    resultado.creadas += 1;
    try {
      if (caja?.terminalId) await partnerOnboardingService.changePosStatus(input.partnerId, String(caja.terminalId), { status: 'active' });
      else resultado.sinActivar += 1;
    } catch {
      resultado.sinActivar += 1;
    }
  }
  return resultado;
}
