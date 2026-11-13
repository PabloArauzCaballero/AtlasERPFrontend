/**
 * La venta completa de una compra a crédito, igual en Solicitudes y en Mi cartera.
 *
 * Antes la tarjeta decía «Importe Bs 680», que es sólo lo que financia Atlas. La venta era de
 * Bs 1 700 y en la caja había que cobrar Bs 1 020: quien atendía no lo sabía. Aquí van las cuatro
 * cifras, con lo que se cobra en caja destacado porque es lo único que el comercio tiene que hacer.
 */
import { formatBob } from '@/lib/formatters';

export interface Venta {
  grossAmount?: string | number | null;
  downPaymentAmount?: string | number | null;
  financedAmount?: string | number | null;
  requestedAmount?: string | number | null;
  planCode?: string | null;
  requestedTermMonths?: number | null;
}

/** «60 % en caja · 40 % en 4 cuotas» a partir del código de la política, o sólo las cuotas. */
export function planLegible(planCode: string | null | undefined, cuotas: number | null | undefined): string | null {
  const reparto = planCode ? /(\d{1,2})-(\d{1,2})/.exec(planCode) : null;
  const enCuotas = cuotas ? `${cuotas} ${cuotas === 1 ? 'cuota' : 'cuotas'}` : null;
  if (reparto) return [`${reparto[1]} % en caja`, enCuotas ? `${reparto[2]} % en ${enCuotas}` : `${reparto[2]} % financiado`].join(' · ');
  return enCuotas ? `Financiado en ${enCuotas}` : null;
}

function cifra(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function VentaEnCaja({ venta, cobrado = false }: Readonly<{ venta: Venta; /** El inicial ya se cobró (cartera): se dice en pasado. */ cobrado?: boolean }>) {
  const financiado = cifra(venta.financedAmount ?? venta.requestedAmount);
  const total = cifra(venta.grossAmount);
  const inicial = cifra(venta.downPaymentAmount);
  const plan = planLegible(venta.planCode, venta.requestedTermMonths);
  return (
    <dl className="grid min-w-[14rem] gap-1 text-right text-xs" data-testid="venta-en-caja">
      {total !== null ? (
        <div>
          <dt className="font-semibold text-slate-500">Total de la venta</dt>
          <dd className="text-2xl font-semibold tabular-nums text-slate-900">{formatBob(total)}</dd>
        </div>
      ) : null}
      {inicial !== null ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
          <dt className="font-semibold">{cobrado ? 'Inicial cobrado en caja' : 'Cobrar en caja'}</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatBob(inicial)}</dd>
        </div>
      ) : null}
      {financiado !== null ? (
        <div>
          <dt className="text-slate-500">Financiado</dt>
          <dd className={total === null ? 'text-2xl font-semibold tabular-nums' : 'font-semibold tabular-nums'}>{formatBob(financiado)}</dd>
        </div>
      ) : null}
      {plan ? <dd className="text-slate-500">{plan}</dd> : null}
    </dl>
  );
}

/** La venta en una línea, para la cabecera de un crédito en la cartera y para el PDF. */
export function resumenDeVenta(venta: Venta & { installmentsCount?: number | null }): string | null {
  const total = cifra(venta.grossAmount);
  const inicial = cifra(venta.downPaymentAmount);
  const financiado = cifra(venta.financedAmount ?? venta.requestedAmount);
  const plan = planLegible(venta.planCode, venta.requestedTermMonths ?? venta.installmentsCount ?? null);
  const partes = [
    total !== null ? `Venta ${formatBob(total)}` : null,
    inicial !== null ? `inicial cobrado en caja ${formatBob(inicial)}` : null,
    financiado !== null ? `financiado ${formatBob(financiado)}` : null,
    plan,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}
