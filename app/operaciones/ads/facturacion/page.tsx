'use client';

import { useState } from 'react';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { formatMicrosAsBob } from '@/lib/formatters';
import { adsService } from '@/services/adsService';
import { loadAdvertisers } from '@/services/optionLoaders';
import type { JsonObject } from '@/services/types';

/**
 * Facturación de anunciantes: cerrar el período y registrar el cobro.
 *
 * Los dos endpoints existían con sus métodos en el servicio y sin pantalla: el consumo publicitario
 * se acumulaba en el libro y nadie podía convertirlo en factura desde la consola, ni anotar que una
 * factura se cobró.
 *
 * **Las facturas se muestran aquí porque no hay dónde volver a verlas.** El módulo no expone un
 * listado de facturas de anunciante —sólo el cierre que las crea y el pago que las salda—, así que
 * los identificadores del cierre se conservan en pantalla hasta recargar: es lo único que permite
 * registrar el pago sin ir a buscarlos a la base.
 */

interface FacturaEmitida {
  invoiceId: string;
  advertiserId: string;
  currency: string;
  totalMicros: number;
}

export default function AdsBillingPage() {
  const [facturas, setFacturas] = useState<FacturaEmitida[]>([]);
  const [seleccionada, setSeleccionada] = useState('');

  async function cerrarPeriodo(payload: JsonObject) {
    const result = (await adsService.closeBillingPeriod(payload)) as { invoices?: FacturaEmitida[] };
    const emitidas = result.invoices ?? [];
    setFacturas(emitidas);
    if (emitidas[0]) setSeleccionada(emitidas[0].invoiceId);
    return result as unknown as Record<string, unknown>;
  }

  async function registrarPago(payload: JsonObject) {
    const { invoiceId, ...resto } = payload;
    return adsService.registerPayment(String(invoiceId ?? ''), resto) as Promise<Record<string, unknown>>;
  }

  const totalMicros = facturas.reduce((total, item) => total + Number(item.totalMicros ?? 0), 0);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Ads' }, { label: 'Facturación' }]}
        title="Facturación de anunciantes"
        description="Convertir el consumo del período en facturas y anotar los cobros que las saldan."
      />

      <InlineActionForm
        title="Cerrar período"
        description="Agrupa el consumo del rango por anunciante y moneda, y emite una factura por grupo. Sin anunciante, cierra todos."
        icon="event_available"
        submitLabel="Cerrar período y emitir"
        successMessage="El período quedó cerrado. Abajo están las facturas emitidas."
        onSubmit={cerrarPeriodo}
        fields={[
          { name: 'periodStart', label: 'Desde', tooltip: 'Inicio del período de consumo que se factura.', type: 'date', required: true },
          { name: 'periodEnd', label: 'Hasta', tooltip: 'Fin del período de consumo que se factura, inclusive.', type: 'date', required: true },
          { name: 'advertiserId', label: 'Anunciante', tooltip: 'Anunciante dueño de la campaña; su crédito y su facturación son los que se consumen.', type: 'select', optional: true, span: 2, optionsLoader: loadAdvertisers, hint: 'Vacío = todos los anunciantes con consumo en el rango.' },
        ]}
      />

      {facturas.length ? (
        <>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <MetricCard label="Facturas emitidas" value={facturas.length} detail="En este cierre" icon="receipt_long" />
            <MetricCard label="Total facturado" value={formatMicrosAsBob(totalMicros)} detail="Suma del cierre" icon="payments" tone="teal" />
            <MetricCard label="Anunciantes" value={new Set(facturas.map((item) => item.advertiserId)).size} detail="Con consumo en el rango" icon="business" tone="purple" />
          </div>
          <Panel title="Facturas de este cierre" description="Pulsa una para registrar su cobro. Al recargar la pantalla desaparecen: el módulo no expone un listado de facturas." icon="receipt">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-[2fr_2fr_1fr_1fr] bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                <span>Factura</span><span>Anunciante</span><span>Moneda</span><span className="text-right">Total</span>
              </div>
              <div className="divide-y divide-slate-100">
                {facturas.map((row) => (
                  <div
                    key={row.invoiceId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSeleccionada(row.invoiceId)}
                    onKeyDown={(event) => { if (event.key === 'Enter') setSeleccionada(row.invoiceId); }}
                    className={`grid cursor-pointer grid-cols-[2fr_2fr_1fr_1fr] items-center px-4 py-2 text-xs ${seleccionada === row.invoiceId ? 'bg-primary-wash' : 'hover:bg-slate-50'}`}
                  >
                    <span className="truncate font-mono text-[11px] text-slate-700">{row.invoiceId}</span>
                    <span className="truncate font-mono text-[11px] text-slate-500">{row.advertiserId}</span>
                    <span className="text-slate-600">{row.currency}</span>
                    <span className="text-right tabular-nums text-slate-800">{formatMicrosAsBob(row.totalMicros)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </>
      ) : (
        <InlineNotice tone="info" title="Todavía no hay facturas en pantalla">
          Cierra un período para emitirlas. Para cobrar una factura anterior, pega su identificador en el formulario de abajo.
        </InlineNotice>
      )}

      <InlineActionForm
        key={seleccionada}
        title="Registrar un cobro"
        description="El importe va en micros, igual que en el resto del módulo publicitario: 1 000 000 = Bs 1. Cobrar el total marca la factura como pagada; cobrar menos la deja parcial."
        icon="paid"
        submitLabel="Registrar cobro"
        successMessage="El cobro quedó registrado."
        onSubmit={registrarPago}
        fields={[
          /*
           * Sigue siendo texto: el backend no expone un listado de facturas de anunciante
           * (`/admin/ads` sólo tiene el cierre que las crea y el cobro que las salda), así que no
           * hay de dónde cargar un desplegable. Pulsar una factura del cierre la deja escrita aquí.
           */
          { name: 'invoiceId', label: 'Factura', tooltip: 'Factura a la que se aplica el cobro.', required: true, span: 2, ...(seleccionada ? { defaultValue: seleccionada } : {}) },
          { name: 'amountMicros', label: 'Importe (micros)', tooltip: 'Importe cobrado en micros (1 Bs = 1 000 000). Ej.: 150000000 = Bs 150.', type: 'number', required: true },
          { name: 'paymentDate', label: 'Fecha del cobro', tooltip: 'Fecha en que entró el dinero, según el banco.', type: 'date', required: true },
          // El medio es un dominio cerrado del backend: como texto libre, cualquier cosa distinta del código exacto era un 400.
          { name: 'paymentMethod', label: 'Medio', tooltip: 'Medio por el que se paga: transferencia, QR, efectivo…; decide qué cuenta bancaria se exige.', required: true, defaultValue: 'TRANSFERENCIA', optionsSource: 'domain:accounting.paymentMethod' },
          { name: 'currency', label: 'Moneda', tooltip: 'Moneda en la que se factura y se consume el crédito (ISO 4217). Ej.: BOB.', optional: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' },
          { name: 'reference', label: 'Referencia', tooltip: 'Número de transacción o comprobante del banco, para conciliar.', optional: true, span: 2, placeholder: 'Nº de transferencia' },
        ]}
      />
    </div>
  );
}
