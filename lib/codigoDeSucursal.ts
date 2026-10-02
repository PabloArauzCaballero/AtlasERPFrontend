/**
 * El código con el que el expediente nombra a una sucursal del ERP.
 *
 * Se DERIVA del identificador de la sucursal en vez de pedírselo a nadie: es único por
 * construcción —el identificador ya lo es—, así que declarar dos veces el mismo local no puede
 * producir dos entradas, y volver a intentarlo después de un fallo de red produce el mismo código
 * y choca con un 409 en vez de duplicar. Pedirlo en un formulario era, además, la mitad del
 * trámite que sobraba: el comercio ya había escrito el nombre del local en «Sucursales».
 *
 * Se usa el identificador ENTERO y no un prefijo. Los de este ERP se emiten en serie
 * —`d9000000-…-9001`, `d9000000-…-9002`— y sólo se diferencian en la cola: cortando por delante,
 * dos locales distintos del mismo comercio recibían el MISMO código y el segundo se rechazaba con
 * `BRANCH_CODE_ALREADY_REGISTERED`, o sea que el comercio no podía abrir su segunda tienda.
 * Un UUID sin guiones son 32 caracteres y el contrato admite 40.
 */
export function codigoDeExpediente(erpBranchId: string): string {
  return `SUC-${erpBranchId.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-36)}`;
}
