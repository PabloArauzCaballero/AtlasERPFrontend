import { descargarPdf, nombreArchivoPdf, tablaPdf, type DocumentoPdf } from './pdf';
import { formatBob, formatDate } from './formatters';
import type { ResourceRow } from '@/services/types';

/**
 * La factura como documento, no como fila de una tabla.
 *
 * Las pantallas ya sabían imprimir el LISTADO —una tabla con lo que se ve en pantalla—, pero eso no
 * es una factura: no lleva sus líneas, ni a quién se le emite, ni el desglose de impuestos. Por eso
 * «descargar la factura» no existía en ninguna de las dos caras del ERP. Aquí se arma el documento a
 * partir del detalle que devuelve el backend y se imprime con el mismo generador que el resto.
 */

interface LineaFactura {
  description?: unknown;
  quantity?: unknown;
  unitAmount?: unknown;
  taxAmount?: unknown;
  totalAmount?: unknown;
}

interface ParteFactura {
  nombre: string;
  nit?: string | undefined;
  detalle?: string | undefined;
}

export interface FacturaImprimible {
  numero: string;
  estado?: string | undefined;
  moneda?: string | undefined;
  fechaEmision?: string | undefined;
  fechaVencimiento?: string | undefined;
  emisor?: ParteFactura | undefined;
  receptor?: ParteFactura | undefined;
  subtotal: number;
  impuesto: number;
  total: number;
  lineas: LineaFactura[];
  /** Referencias fiscales (CUF, CUFD, referencia externa) que acompañan al documento. */
  referencias?: Array<{ label: string; value: string }> | undefined;
  /** Nota al pie: sirve para decir que es una representación interna y no el documento SIAT. */
  aviso?: string | undefined;
}

const numero = (valor: unknown): number => {
  const parsed = Number(valor ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parte(titulo: string, datos: ParteFactura | undefined) {
  return {
    title: titulo,
    fields: [
      { label: 'Nombre o razón social', value: datos?.nombre ?? '—' },
      { label: 'NIT / identificación fiscal', value: datos?.nit ?? '—' },
      ...(datos?.detalle ? [{ label: 'Domicilio', value: datos.detalle }] : []),
    ],
  };
}

export function documentoFactura(factura: FacturaImprimible): DocumentoPdf {
  const moneda = factura.moneda ?? 'BOB';
  return {
    title: `Factura ${factura.numero}`,
    subtitle: [
      factura.emisor?.nombre,
      factura.fechaEmision ? `Emitida el ${formatDate(factura.fechaEmision)}` : null,
      factura.estado ? factura.estado.replaceAll('_', ' ') : null,
    ]
      .filter(Boolean)
      .join(' · '),
    summary: [
      { label: 'Subtotal', value: formatBob(factura.subtotal) },
      { label: 'Impuesto', value: formatBob(factura.impuesto) },
      { label: 'Total', value: formatBob(factura.total), caption: moneda },
      { label: 'Vencimiento', value: factura.fechaVencimiento ? formatDate(factura.fechaVencimiento) : '—' },
    ],
    ...(factura.aviso
      ? { notices: [{ level: 'caution' as const, title: 'Representación interna', text: factura.aviso }] }
      : {}),
    sections: [
      parte('Emisor', factura.emisor),
      parte('Receptor', factura.receptor),
      {
        title: 'Detalle',
        description: `Importes en ${moneda}.`,
        table: tablaPdf(
          [
            { key: 'description', label: 'Concepto' },
            { key: 'quantity', label: 'Cantidad' },
            { key: 'unitAmount', label: 'Precio unitario' },
            { key: 'taxAmount', label: 'Impuesto' },
            { key: 'totalAmount', label: 'Total' },
          ],
          factura.lineas as Array<Record<string, unknown>>,
          (fila, clave) => {
            if (clave === 'description') return String(fila.description ?? '—');
            if (clave === 'quantity') return String(fila.quantity ?? '1');
            return formatBob(numero(fila[clave]));
          },
        ),
      },
      {
        title: 'Totales',
        fields: [
          { label: 'Subtotal', value: formatBob(factura.subtotal) },
          { label: 'Impuesto', value: formatBob(factura.impuesto) },
          { label: 'Total a pagar', value: formatBob(factura.total) },
          ...(factura.referencias ?? []).map((referencia) => ({
            label: referencia.label,
            value: referencia.value,
          })),
        ],
      },
    ],
  };
}

/** Arma el documento y lo deja en el disco del usuario. */
export async function descargarFactura(factura: FacturaImprimible): Promise<void> {
  const documento = documentoFactura(factura);
  await descargarPdf(documento, nombreArchivoPdf(`factura-${factura.numero}`));
}

/** Detalle de una factura de comercio (`/b2b/billing/invoices/:id` o `/portal/billing/invoices/:id`). */
export function facturaDeComercio(
  detalle: ResourceRow,
  opciones: { aviso?: string | undefined } = {},
): FacturaImprimible {
  // El portal devuelve `{ invoice, lines, account }`; el ERP devuelve la factura plana con `lines`.
  const invoice = (detalle.invoice ?? detalle) as Record<string, unknown>;
  const account = detalle.account as Record<string, unknown> | null | undefined;
  const lineas = ((detalle.lines ?? invoice.lines ?? []) as LineaFactura[]) ?? [];
  return {
    numero: String(invoice.invoiceNumber ?? '—'),
    estado: invoice.status ? String(invoice.status) : undefined,
    fechaEmision: invoice.invoiceDate ? String(invoice.invoiceDate) : undefined,
    fechaVencimiento: invoice.dueDate ? String(invoice.dueDate) : undefined,
    emisor: { nombre: 'Atlas', nit: undefined, detalle: undefined },
    receptor: account
      ? {
          nombre: String(account.legalName ?? account.tradeName ?? '—'),
          nit: account.taxId ? String(account.taxId) : undefined,
          detalle: [account.address, account.city].filter(Boolean).join(', ') || undefined,
        }
      : undefined,
    subtotal: numero(invoice.subtotalAmount),
    impuesto: numero(invoice.taxAmount),
    total: numero(invoice.totalAmount),
    lineas,
    ...(invoice.externalTaxRef
      ? { referencias: [{ label: 'Referencia fiscal externa', value: String(invoice.externalTaxRef) }] }
      : {}),
    ...(opciones.aviso ? { aviso: opciones.aviso } : {}),
  };
}

/** Detalle de una factura AR de contabilidad (`/accounting/billing/ar-invoices/:id`). */
export function facturaAr(detalle: ResourceRow): FacturaImprimible {
  const invoice = (detalle.invoice ?? {}) as Record<string, unknown>;
  const customer = detalle.customer as Record<string, unknown> | null | undefined;
  const legalEntity = detalle.legalEntity as Record<string, unknown> | null | undefined;
  const fiscal = detalle.electronicTaxDocument as Record<string, unknown> | null | undefined;
  const lineas = ((detalle.lines ?? []) as Array<Record<string, unknown>>).map((linea) => ({
    description: linea.description,
    quantity: linea.qty,
    unitAmount: linea.unitPrice,
    taxAmount: 0,
    totalAmount: linea.lineAmount,
  }));

  const referencias: Array<{ label: string; value: string }> = [];
  if (fiscal?.cuf) referencias.push({ label: 'CUF', value: String(fiscal.cuf) });
  if (fiscal?.cufd) referencias.push({ label: 'CUFD', value: String(fiscal.cufd) });
  if (fiscal?.siatStatus) referencias.push({ label: 'Estado SIAT', value: String(fiscal.siatStatus) });

  return {
    numero: String(invoice.invoiceNo ?? '—'),
    estado: invoice.status ? String(invoice.status) : undefined,
    moneda: invoice.currencyCode ? String(invoice.currencyCode) : undefined,
    fechaEmision: invoice.invoiceDate ? String(invoice.invoiceDate) : undefined,
    fechaVencimiento: invoice.dueDate ? String(invoice.dueDate) : undefined,
    emisor: legalEntity
      ? {
          nombre: String(legalEntity.legalName ?? '—'),
          nit: legalEntity.taxId ? String(legalEntity.taxId) : undefined,
        }
      : undefined,
    receptor: customer
      ? {
          nombre: String(customer.legalName ?? '—'),
          nit: customer.taxId ? String(customer.taxId) : undefined,
        }
      : undefined,
    subtotal: numero(invoice.netAmount),
    impuesto: numero(invoice.taxAmount),
    total: numero(invoice.grossAmount),
    lineas,
    ...(referencias.length ? { referencias } : {}),
    ...(String(fiscal?.siatStatus ?? '') === 'ACCEPTED'
      ? {}
      : {
          aviso:
            'Este documento es la representación interna de la factura en el ERP. Mientras el ' +
            'documento fiscal electrónico no esté aceptado por el SIAT, no sustituye a la factura fiscal.',
        }),
  };
}
