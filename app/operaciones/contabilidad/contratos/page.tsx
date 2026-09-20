'use client';

import { useCallback } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';
import { loadBusinessPartners, loadLegalEntities } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

const headerFields: ActionField[] = [
  // El número lo asigna el backend (CTA-…): pedirlo obligaba a adivinar el siguiente de la serie.
  { name: 'contractNo', label: 'Número de contrato', tooltip: 'Número del contrato tal como figura en el documento firmado.', assignedByBackend: true },
  { name: 'contractType', label: 'Tipo', tooltip: 'Naturaleza del contrato (servicio, licencia, arrendamiento…); decide términos y cuentas.', required: true, optionsSource: 'domain:accounting.contractType' },
  { name: 'legalEntityId', label: 'Empresa que firma', tooltip: 'Empresa del grupo que firma el contrato; de ella salen el libro contable, la moneda y la numeración.', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadLegalEntities },
  { name: 'counterpartyBpId', label: 'Con quién se firma', tooltip: 'La otra parte del contrato: el cliente, el proveedor o el comercio con el que se pacta.', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadBusinessPartners },
  { name: 'startDate', label: 'Fecha inicial', tooltip: 'Fecha en que entra en vigor.', type: 'date' as const, required: true },
  { name: 'endDate', label: 'Fecha final', tooltip: 'Fecha en que termina; vacío = indefinido.', type: 'date' as const, optional: true },
  { name: 'currencyCode', label: 'Moneda', tooltip: 'Moneda del importe (ISO 4217). Ej.: BOB. Decide el tipo de cambio al contabilizar.', defaultValue: 'BOB', required: true, span: 2 as const, optionsSource: 'catalog:currency' },
];

export default function AccountingContractsPage() {
  const tiposContrato = useOptions(domainLoader('domain:accounting.contractType'));
  const estadosContrato = useOptions(domainLoader('domain:accounting.contractStatus'));

  /*
   * La contraparte se guarda como UUID y así llegaba a la tabla: una columna de 36 caracteres que
   * no dice de quién es el contrato. Se cruza con el maestro de business partners para enseñar el
   * nombre, y si el cruce no encuentra nada se deja el identificador en vez de inventar un guion.
   */
  const load = useCallback(async () => {
    const [contracts, partners] = await Promise.all([
      accountingService.listContracts(),
      loadBusinessPartners().catch(() => []),
    ]);
    const nameById = new Map(partners.map((partner) => [partner.value, partner.label]));
    const rows = (contracts.items ?? contracts.rows ?? []) as ResourceRow[];
    return rows.map((row) => ({
      ...row,
      counterpartyName: nameById.get(String(row.counterpartyBpId ?? '')) ?? String(row.counterpartyBpId ?? '—'),
    }));
    /* Ya no hay que forzar recargas: `CrudDirectory` relee la tabla al terminar una acción de fila. */
  }, []);

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Contratos contables"
      description="Todos los contratos registrados: facturación a clientes, proveedores, préstamos, intercompany y comercios."
      load={load}
      searchPlaceholder="Buscar por número, contraparte o moneda…"
      emptyHint="Usa «Crear contrato» para registrar la primera cabecera contractual."
      labelKey="contractNo"
      columns={[
        { key: 'contractNo', label: 'Número', kind: 'mono' },
        { key: 'contractType', label: 'Tipo' },
        { key: 'counterpartyName', label: 'Contraparte' },
        { key: 'startDate', label: 'Inicio', kind: 'date' },
        { key: 'endDate', label: 'Fin', kind: 'date' },
        { key: 'currencyCode', label: 'Moneda' },
        { key: 'status', label: 'Estado', kind: 'status' },
      ]}
      filters={[
        { key: 'contractType', label: 'Tipo', options: tiposContrato },
        { key: 'status', label: 'Estado', options: estadosContrato },
        { key: 'currencyCode', label: 'Moneda' },
      ]}
      create={{
        label: 'Crear contrato',
        title: 'Nuevo contrato contable',
        description: 'Identificación, contrapartes, vigencia y moneda.',
        fields: headerFields,
        submit: (payload: JsonObject) => accountingService.createContract(payload),
      }}
      edit={{
        description: 'Con quién se firma y qué empresa firma no se cambian: eso movería el contrato de libro contable.',
        fields: [
          { name: 'contractNo', label: 'Número de contrato', tooltip: 'Número del contrato tal como figura en el documento firmado.', assignedByBackend: true, hint: 'Asignado por el sistema; no se cambia.' },
          { name: 'contractType', label: 'Tipo', tooltip: 'Naturaleza del contrato (servicio, licencia, arrendamiento…); decide términos y cuentas.', required: true, optionsSource: 'domain:accounting.contractType' },
          { name: 'startDate', label: 'Fecha inicial', tooltip: 'Fecha en que entra en vigor.', type: 'date', required: true },
          { name: 'endDate', label: 'Fecha final', tooltip: 'Fecha en que termina; vacío = indefinido.', type: 'date', optional: true },
          { name: 'status', label: 'Estado', tooltip: 'Estado del registro; decide qué acciones se permiten sobre él y si aparece en los listados operativos.', required: true, optionsSource: 'domain:accounting.contractStatus' },
        ],
        submit: (id, payload) => accountingService.updateContract(id, payload),
      }}
      remove={{
        submit: (id) => accountingService.deleteContract(id),
        warning: 'Se pierden también sus términos contractuales. Si el contrato ya facturó, márcalo como TERMINATED en vez de borrarlo.',
      }}
      /*
       * El término se añade DESDE la fila de su contrato.
       *
       * Estaba en un formulario bajo la tabla cuyo primer campo era un desplegable «Contrato»: el
       * usuario ya tenía la fila delante y tenía que volver a elegirla, con el riesgo de colgarle
       * el plazo de pago al contrato de otro socio. Y sin contratos aún, el desplegable sólo sabía
       * decir que no había datos, con el formulario entero pidiendo lo demás para nada.
       */
      extraActions={[
        {
          key: 'termino',
          label: 'Agregar condición',
          icon: 'data_object',
          form: {
            title: (row) => `Condición de ${String(row.contractNo ?? 'el contrato')}`,
            description: 'Lo que se pactó y desde cuándo rige: el plazo de pago, la comisión, el tope mensual. Cada condición tiene su propia vigencia, así que una renegociación se añade sin borrar la anterior.',
            fields: [
              { name: 'termCode', label: 'Qué se pactó', tooltip: 'Nombre corto de lo pactado, en mayúsculas y sin espacios. Ej.: PLAZO_PAGO, COMISION, TOPE_MENSUAL.', required: true, placeholder: 'PLAZO_PAGO' },
              { name: 'termValue', label: 'Valor pactado', tooltip: 'Lo que se acordó para esa condición, tal como se lee en el contrato. Ej.: 30 días.', required: true, placeholder: '30 días' },
              { name: 'effectiveFrom', label: 'Rige desde', tooltip: 'Desde cuándo se aplica lo pactado; antes de esa fecha vale la condición anterior.', type: 'date', required: true },
              { name: 'effectiveTo', label: 'Rige hasta', tooltip: 'Hasta cuándo se aplica; vacío significa que sigue vigente sin fecha de fin.', type: 'date', optional: true },
            ],
            submit: (row, payload) =>
              accountingService.createContractTerm({
                ...payload,
                contractId: String(row.id ?? ''),
                termValueJson: { value: payload.termValue },
                termValue: undefined,
              }),
            submitLabel: 'Agregar condición',
          },
        },
      ]}
    />
  );
}
