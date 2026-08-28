'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { formatDate } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import { accountingService } from '@/services/accountingService';
import { loadBusinessPartners, loadLegalEntities } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * Condiciones de pago a proveedor.
 *
 * La tabla, el modelo, el catálogo de vocabulario y el cálculo del vencimiento estaban escritos y
 * probados desde el principio, y no había ni un endpoint ni una pantalla: «cómo se le paga a este
 * proveedor» seguía siendo una nota a mano, que es justo lo que la tabla venía a sustituir.
 *
 * Las listas de esta pantalla NO están copiadas aquí: se piden a `/catalog`, que es el mismo
 * catálogo que gobierna el cálculo. Una copia se separaría el día que se añada una modalidad, y
 * quien la necesite no podría elegirla sin que nada delatara por qué falta.
 */

interface OpcionCatalogo { code: string; label: string; help?: string }

function s(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function opciones(lista: OpcionCatalogo[] | undefined) {
  return (lista ?? []).map((item) => ({ label: item.label, value: item.code }));
}

export default function SupplierPaymentTermsPage() {
  const [catalogo, setCatalogo] = useState<Record<string, OpcionCatalogo[]>>({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void accountingService
      .getSupplierPaymentTermsCatalog()
      .then((data) => setCatalogo(data as unknown as Record<string, OpcionCatalogo[]>))
      .catch(() => setCatalogo({}));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => accountingService.listSupplierPaymentTerms(), [version]);

  /* Los mismos campos en el alta y en la edición, salvo lo que identifica a la condición. */
  const camposComunes: ActionField[] = [
    { name: 'name', label: 'Nombre', required: true, span: 2 },
    { name: 'modality', label: 'Modalidad', type: 'select', required: true, options: opciones(catalogo.modalidades) },
    { name: 'computationBase', label: 'Base de cómputo', type: 'select', required: true, options: opciones(catalogo.basesDeComputo), hint: 'Desde qué fecha se cuentan los días.' },
    { name: 'termDays', label: 'Plazo (días)', type: 'number', optional: true, hint: 'Las modalidades de días fijos —contado, contra entrega— lo ignoran.' },
    { name: 'paymentMethod', label: 'Medio de pago', type: 'select', required: true, options: opciones(catalogo.mediosDePago) },
    { name: 'frequency', label: 'Frecuencia', type: 'select', optional: true, options: opciones(catalogo.frecuencias) },
    { name: 'bpBankAccountId', label: 'Cuenta bancaria del proveedor', optional: true, span: 2, hint: 'UUID. Transferencia y QR la exigen: sin ella la condición no se puede ejecutar.' },
    { name: 'advancePercentage', label: 'Anticipo (%)', type: 'number', optional: true },
    { name: 'earlyPaymentDiscount', label: 'Descuento pronto pago (%)', type: 'number', optional: true },
    { name: 'status', label: 'Estado', type: 'select', optional: true, options: opciones(catalogo.estados) },
    { name: 'validFrom', label: 'Vigente desde', type: 'date', required: true },
    { name: 'validTo', label: 'Vigente hasta', type: 'date', optional: true, hint: 'Vacío = sin fecha de fin.' },
    { name: 'specialConditions', label: 'Condiciones especiales', type: 'textarea', optional: true, span: 3 },
  ];

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Condiciones de pago a proveedor"
      description="Cómo se le paga a cada proveedor, como dato y no como nota: modalidad, plazo, medio y vigencia."
      load={load}
      labelKey="name"
      searchPlaceholder="Buscar por código, nombre o modalidad…"
      emptyHint="Sin condiciones pactadas. Mientras no haya una, el vencimiento de sus facturas no se puede calcular."
      notice={{
        tone: 'info',
        title: 'Por qué hay varias por proveedor',
        body: 'Una condición es histórica: se renegocia, y las facturas ya emitidas se pactaron con la anterior. Por eso no se edita el pasado sino que se pacta otra con nueva vigencia. Sólo puede haber UNA activa por proveedor y moneda: si la hay, hay que suspenderla antes de activar la siguiente.',
      }}
      columns={[
        { key: 'code', label: 'Código', kind: 'mono' },
        { key: 'name', label: 'Condición' },
        { key: 'modality', label: 'Modalidad', kind: 'status' },
        { key: 'computationBase', label: 'Base', kind: 'status' },
        { key: 'termDays', label: 'Días', align: 'right' },
        { key: 'paymentMethod', label: 'Medio', kind: 'status' },
        { key: 'currencyCode', label: 'Moneda' },
        { key: 'status', label: 'Estado', kind: 'status' },
        { key: 'validFrom', label: 'Desde', kind: 'date' },
        { key: 'validTo', label: 'Hasta', kind: 'date' },
      ]}
      filters={[
        { key: 'status', label: 'Estado', options: opciones(catalogo.estados) },
        { key: 'modality', label: 'Modalidad', options: opciones(catalogo.modalidades) },
      ]}
      create={{
        label: 'Pactar condición',
        title: 'Nueva condición de pago',
        description: 'Se revisa antes de guardarse: si la condición no se puede ejecutar —un crédito sin plazo, una transferencia sin cuenta— se rechaza aquí y no en la corrida de pagos del viernes.',
        fields: [
          { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, span: 2, optionsLoader: loadLegalEntities },
          { name: 'supplierBpId', label: 'Proveedor', type: 'select', required: true, span: 2, optionsLoader: loadBusinessPartners },
          { name: 'code', label: 'Código', required: true, placeholder: 'NETO30', hint: 'Para citarla en un contrato sin pegar un UUID.' },
          { name: 'currencyCode', label: 'Moneda', required: true, defaultValue: 'BOB' },
          ...camposComunes,
        ],
        submit: async (payload: JsonObject) => {
          const created = await accountingService.createSupplierPaymentTerms(payload);
          setVersion((value) => value + 1);
          return created;
        },
      }}
      edit={{
        description: 'El proveedor, el código y la moneda no se cambian: identifican la condición. Para pactar otras, se crea una nueva con su vigencia.',
        fields: camposComunes,
        submit: (id, payload) => accountingService.updateSupplierPaymentTerms(id, payload),
      }}
      extraActions={[
        {
          key: 'simular',
          label: 'Simular vencimiento',
          icon: 'event_available',
          form: {
            title: (row: ResourceRow) => `Vencimiento con «${s(row.name)}»`,
            description: 'Con qué fecha vence una factura concreta bajo esta condición, y cuánto se adelanta. No guarda nada.',
            fields: [
              { name: 'invoiceDate', label: 'Fecha de factura', type: 'date', required: true },
              { name: 'receptionDate', label: 'Fecha de recepción', type: 'date', optional: true, hint: 'Sólo la usan las bases de cómputo por recepción.' },
              { name: 'amount', label: 'Importe', type: 'number', required: true },
            ],
            submit: async (row: ResourceRow, payload: JsonObject) => {
              const result = (await accountingService.simulateSupplierPaymentSchedule(s(row.id), payload)) as Record<string, unknown>;
              const schedule = (result.schedule ?? {}) as Record<string, unknown>;
              const problemas = (result.problems ?? []) as Array<{ message?: string }>;
              /* El resultado se dice en el aviso: es la respuesta a la pregunta que se hizo, y no
               * hay fila que actualizar porque la simulación no escribe. */
              toast.success(
                `Vence el ${formatDate(s(schedule.vencimiento))}`,
                `Base ${formatDate(s(schedule.base))} · anticipo ${s(schedule.montoAnticipo)} · diferido ${s(schedule.montoDiferido)}`,
              );
              if (problemas.length) {
                toast.warning('La condición tiene reparos', problemas.map((item) => item.message).join(' · '));
              }
              return result;
            },
            submitLabel: 'Calcular',
          },
        },
      ]}
    />
  );
}
