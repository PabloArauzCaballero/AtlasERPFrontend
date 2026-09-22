'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { b2bService } from '@/services/b2bService';
import { loadB2BAccounts, loadMerchantBranches } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * Cobertura y conciliación: tres tablas, y cada operación en la fila sobre la que actúa.
 *
 * La vista tenía siete pestañas —tres tablas y cuatro formularios— y cada formulario abría con un
 * desplegable para volver a elegir la cuota, la cobertura o la recuperación que el usuario acababa
 * de ver en la tabla de al lado. Elegir mal ahí era programarle una cobertura a otra cuota sin que
 * nada lo advirtiera. Ahora se programa desde la cuota, se confirma el pago desde la cobertura y se
 * aplica la recuperación desde la recuperación; la conciliación del período, que no cuelga de
 * ninguna fila, es un botón de la barra.
 */
export default function CoverageReconciliationPage() {
  const [tab, setTab] = useState('coberturas');
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((value) => value + 1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarPayables = useCallback(() => b2bService.listPayables(), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarCuotas = useCallback(() => b2bService.listInstallments(), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarRecuperaciones = useCallback(() => b2bService.listRecoveries(), [version]);

  async function programarCobertura(row: ResourceRow, payload: JsonObject) {
    const resultado = await b2bService.createPayable({ ...payload, installmentId: String(row.id ?? '') });
    recargar();
    return resultado;
  }

  async function confirmarPago(row: ResourceRow, payload: JsonObject) {
    const resultado = await b2bService.markPayablePaid(String(row.id ?? ''), payload);
    recargar();
    return resultado;
  }

  async function aplicarRecuperacion(row: ResourceRow, payload: JsonObject) {
    const resultado = await b2bService.applyRecoveryPayment(String(row.id ?? ''), payload);
    recargar();
    return resultado;
  }

  const conciliar = {
    key: 'conciliacion',
    label: 'Ejecutar conciliación',
    icon: 'sync_alt',
    title: 'Ejecutar conciliación del período',
    description: 'Cuadra lo cubierto, lo pagado y lo recuperado entre dos fechas.',
    submitLabel: 'Ejecutar',
    submit: async (payload: JsonObject) => {
      const resultado = await b2bService.createReconciliationRun(payload);
      recargar();
      return resultado;
    },
    fields: [
      { name: 'periodStart', label: 'Desde', tooltip: 'Inicio del período de consumo que se factura.', type: 'date' as const, required: true },
      { name: 'periodEnd', label: 'Hasta', tooltip: 'Fin del período de consumo que se factura, inclusive.', type: 'date' as const, required: true },
    ],
  };

  /**
   * Registrar una venta a plazos desde el ERP.
   *
   * `POST /b2b/bnpl/purchases` existía con su método en el servicio y sin pantalla: un operador
   * interno no podía registrar una compra por el comercio, aunque el endpoint lo contempla
   * explícitamente («el operador interno sigue eligiendo, que es su trabajo»).
   *
   * El formulario pide lo que se sabe en el mostrador y DERIVA el resto, porque el backend impone
   * la aritmética y rechaza lo que no cuadre: la entrada es el 60 % de la compra, lo financiado es
   * el resto, y las cuotas reparten ese resto en partes iguales con el redondeo en la última. Pedir
   * esas cifras a mano sería pedir que se calcule fuera lo que el sistema ya sabe, y equivocarse una
   * sola vez devuelve un error de validación en vez de una venta.
   */
  const registrarCompra = {
    key: 'compra',
    label: 'Registrar compra a plazos',
    icon: 'add_shopping_cart',
    title: 'Nueva compra a plazos',
    description: 'La entrada es el 60 % del precio y se paga en el momento; el 40 % restante se reparte en las cuotas.',
    submitLabel: 'Registrar compra',
    fields: [
      { name: 'merchantAccountId', label: 'Comercio', tooltip: 'Comercio afiliado sobre el que se opera.', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadB2BAccounts },
      { name: 'branchId', label: 'Sucursal', tooltip: 'Sucursal del comercio; sólo las habilitadas pueden originar operaciones.', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadMerchantBranches, hint: 'Sólo las sucursales habilitadas pueden originar.' },
      { name: 'consumerExternalRef', label: 'Documento del cliente', tooltip: 'Documento de identidad del cliente final, como lo tiene el comercio. Ej.: 7654321.', required: true, hint: 'Es lo que el comercio tiene delante; el código interno lo resuelve el sistema.' },
      { name: 'purchaseAmount', label: 'Precio de la compra (Bs)', tooltip: 'Precio total de la compra en bolivianos, con hasta dos decimales.', type: 'number' as const, required: true },
      { name: 'cuotas', label: 'Número de cuotas', tooltip: 'En cuántas cuotas se paga. Ej.: 6.', type: 'number' as const, required: true, defaultValue: '3' },
      { name: 'primeraCuota', label: 'Primera cuota vence', tooltip: 'Fecha en que vence la primera cuota; las demás se calculan a partir de ella.', type: 'date' as const, required: true },
      { name: 'mdrReceivableDueDate', label: 'Vence la comisión al comercio', tooltip: 'Fecha límite para que el comercio pague la comisión (MDR) de esta operación.', type: 'date' as const, required: true },
      /* Mismo vocabulario que las reglas de comisión: una categoría tecleada no casaría con ninguna. */
      { name: 'productCategory', label: 'Categoría del producto', tooltip: 'Categoría del producto vendido; decide la comisión que aplica.', optional: true, span: 2 as const, optionsSource: 'domain:crm.merchantCategory' as const },
    ],
    submit: async (payload: JsonObject) => {
      const redondear = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
      const precio = Number(payload.purchaseAmount ?? 0);
      const entrada = redondear(precio * 0.6);
      const financiado = redondear(precio - entrada);
      const numero = Math.max(1, Number(payload.cuotas ?? 1));
      const base = redondear(financiado / numero);

      const cuotas = Array.from({ length: numero }, (_, indice) => {
        const vence = new Date(`${String(payload.primeraCuota)}T00:00:00.000Z`);
        vence.setUTCMonth(vence.getUTCMonth() + indice);
        /* El redondeo se acumula en la ÚLTIMA cuota: repartirlo daría cuotas que no suman lo
         * financiado, y el backend rechaza la compra entera por un céntimo. */
        const importe = indice === numero - 1 ? redondear(financiado - base * (numero - 1)) : base;
        return { installmentNumber: indice + 1, dueDate: vence.toISOString().slice(0, 10), amount: importe };
      });

      return b2bService.registerPurchase({
        merchantAccountId: payload.merchantAccountId,
        branchId: payload.branchId,
        consumerExternalRef: payload.consumerExternalRef,
        purchaseAmount: precio,
        downPaymentAmount: entrada,
        financedAmount: financiado,
        mdrReceivableDueDate: payload.mdrReceivableDueDate,
        ...(payload.productCategory ? { productCategory: payload.productCategory } : {}),
        installments: cuotas,
      });
    },
  };

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Cobertura y conciliación' }]}
        title="Cobertura y conciliación"
        description="Cuotas en mora que Atlas cubre al comercio, coberturas programadas y recuperación posterior al consumidor."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'coberturas',
            label: 'Coberturas',
            icon: 'shield',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Coberturas programadas"
                description="Lo que Atlas se ha comprometido a pagar al comercio por cuotas incumplidas."
                load={cargarPayables}
                labelKey="status"
                searchPlaceholder="Buscar por estado o motivo…"
                emptyHint="Una cobertura se programa desde la pestaña «Cuotas», sobre la cuota en mora."
                columns={[
                  { key: 'amount', label: 'Importe', kind: 'money', align: 'right' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                  { key: 'reason', label: 'Motivo' },
                  { key: 'scheduledPaymentDate', label: 'Programado', kind: 'date' },
                  { key: 'paidAt', label: 'Pagado', kind: 'date' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                toolbarActions={[conciliar]}
                extraActions={[
                  {
                    key: 'pagar',
                    label: 'Confirmar pago',
                    icon: 'paid',
                    enabled: (row) => String(row.status ?? '') !== 'PAID' && String(row.status ?? '') !== 'CANCELLED',
                    form: {
                      title: () => 'Confirmar el pago de la cobertura',
                      description: 'Marca la cobertura como pagada al comercio y abre su recuperación frente al consumidor.',
                      submitLabel: 'Marcar pagado',
                      submit: confirmarPago,
                      fields: [{ name: 'paidAt', label: 'Fecha y hora del pago', tooltip: 'Fecha y hora exactas del pago según el comprobante.', type: 'datetime', required: true, span: 2 }],
                    },
                  },
                ]}
                notice={{
                  tone: 'info',
                  title: 'Una cobertura no se edita ni se borra',
                  body: 'Es un compromiso de pago con el comercio. Se cierra confirmando el pago desde su propia fila, y lo que se recupera después del consumidor va por la pestaña de recuperaciones.',
                }}
              />
            ),
          },
          {
            id: 'cuotas',
            label: 'Cuotas',
            icon: 'event_repeat',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Cuotas de compras a plazo"
                description="El calendario del que salen las moras: es lo que decide si hay que cubrir."
                load={cargarCuotas}
                toolbarActions={[registrarCompra]}
                /*
                 * El alta de este listado no es un botón «Crear»: es la acción «Registrar compra a
                 * plazos» del cajón, y por eso se quedaba sin importar. Se declara con los MISMOS
                 * campos y el MISMO envío de esa acción —incluida la aritmética de la entrada y las
                 * cuotas—, así que una compra importada nace idéntica a una registrada a mano. Es
                 * lo que hace falta para cargar la jornada de un comercio de una vez.
                 */
                importar={{ entidad: 'compras a plazos', fields: registrarCompra.fields, submit: registrarCompra.submit }}
                labelKey="installmentNumber"
                searchPlaceholder="Buscar por estado…"
                emptyHint="Las cuotas nacen al registrar una compra a plazo."
                columns={[
                  { key: 'installmentNumber', label: 'Cuota', align: 'right' },
                  { key: 'dueDate', label: 'Vence', kind: 'date' },
                  { key: 'amount', label: 'Importe', kind: 'money', align: 'right' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                  { key: 'purchaseId', label: 'Compra', kind: 'mono' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                extraActions={[
                  {
                    key: 'cubrir',
                    label: 'Programar cobertura',
                    icon: 'shield',
                    /* Sólo tiene sentido sobre lo que sigue impagado: lo cubierto ya tiene su compromiso. */
                    enabled: (row) => ['SCHEDULED', 'OVERDUE'].includes(String(row.status ?? '')),
                    form: {
                      title: (row) => `Programar cobertura de la cuota ${String(row.installmentNumber ?? '')}`,
                      description: 'Genera el compromiso de pago al comercio por esta cuota incumplida.',
                      submitLabel: 'Programar cobertura',
                      submit: programarCobertura,
                      fields: [
                        { name: 'scheduledPaymentDate', label: 'Fecha programada', tooltip: 'Fecha en la que se programa el pago.', type: 'date', required: true },
                        { name: 'reason', label: 'Motivo', tooltip: 'Motivo breve del cambio; queda en la bitácora para que otro entienda por qué se hizo.', defaultValue: 'CUSTOMER_INSTALLMENT_DEFAULT_COVERAGE' },
                      ],
                    },
                  },
                ]}
              />
            ),
          },
          {
            id: 'recuperaciones',
            label: 'Recuperaciones',
            icon: 'currency_exchange',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Recuperaciones abiertas"
                description="Lo cubierto por Atlas que todavía hay que recuperar del consumidor."
                load={cargarRecuperaciones}
                labelKey="recoveryStatus"
                searchPlaceholder="Buscar por estado…"
                emptyHint="Una recuperación nace al confirmar el pago de una cobertura."
                columns={[
                  { key: 'recoveryStatus', label: 'Estado', kind: 'status' },
                  { key: 'amountCoveredByAtlas', label: 'Cubierto por Atlas', kind: 'money', align: 'right' },
                  { key: 'amountRecovered', label: 'Recuperado', kind: 'money', align: 'right' },
                  { key: 'daysPastDue', label: 'Días de mora', align: 'right' },
                ]}
                filters={[{ key: 'recoveryStatus', label: 'Estado' }]}
                extraActions={[
                  {
                    key: 'recuperar',
                    label: 'Aplicar recuperación',
                    icon: 'currency_exchange',
                    enabled: (row) => !['RECOVERED', 'WRITTEN_OFF'].includes(String(row.recoveryStatus ?? '')),
                    form: {
                      title: () => 'Aplicar un pago del consumidor',
                      description: 'Aplica lo cobrado contra lo que Atlas adelantó al comercio.',
                      submitLabel: 'Aplicar pago',
                      /* Por defecto, lo que falta por recuperar: es el importe que se aplica casi siempre. */
                      fields: (row) => [
                        {
                          name: 'amount',
                          label: 'Monto', tooltip: 'Importe en la moneda indicada, con hasta dos decimales. Ej.: 1250.50.',
                          type: 'number',
                          valueKind: 'number',
                          required: true,
                          span: 2,
                          defaultValue: String(Math.max(Number(row.amountCoveredByAtlas ?? 0) - Number(row.amountRecovered ?? 0), 0)),
                        },
                      ],
                      submit: aplicarRecuperacion,
                    },
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
