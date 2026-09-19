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
  { name: 'legalEntityId', label: 'Entidad legal', tooltip: 'Empresa del grupo que emite o recibe el documento; decide libro, moneda y numeración.', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadLegalEntities },
  { name: 'counterpartyBpId', label: 'Contraparte (Business Partner)', tooltip: 'Socio con el que se firma el contrato.', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadBusinessPartners },
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
        description: 'La contraparte y la entidad legal no se cambian: eso movería el contrato de libro.',
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
          label: 'Agregar término contractual',
          icon: 'data_object',
          form: {
            title: (row) => `Término de ${String(row.contractNo ?? 'el contrato')}`,
            description: 'Término estructurado con vigencia propia, colgado de este contrato.',
            fields: [
              { name: 'termCode', label: 'Código del término', tooltip: 'Código del término contractual. Ej.: PLAZO_PAGO.', required: true },
              { name: 'termValue', label: 'Valor contractual', tooltip: 'Valor pactado para el término. Ej.: 30 días.', required: true },
              { name: 'effectiveFrom', label: 'Vigente desde', tooltip: 'Desde cuándo vale; antes de esta fecha el rol no aplica.', type: 'date', required: true },
              { name: 'effectiveTo', label: 'Vigente hasta', tooltip: 'Hasta cuándo vale; vacío = sin fecha de fin.', type: 'date', optional: true },
            ],
            submit: (row, payload) =>
              accountingService.createContractTerm({
                ...payload,
                contractId: String(row.id ?? ''),
                termValueJson: { value: payload.termValue },
                termValue: undefined,
              }),
            submitLabel: 'Agregar término',
          },
        },
      ]}
    />
  );
}
