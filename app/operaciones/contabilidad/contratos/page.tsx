'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { accountingService } from '@/services/accountingService';
import { loadBusinessPartners, loadContracts, loadLegalEntities } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

const contractTypes = ['CUSTOMER_BILLING', 'SUPPLIER', 'LOAN', 'INTERCOMPANY', 'MERCHANT'];
const typeOptions = contractTypes.map((value) => ({ label: value.replaceAll('_', ' '), value }));

const headerFields = [
  { name: 'contractNo', label: 'Número de contrato', required: true, placeholder: 'CTR-2026-001' },
  { name: 'contractType', label: 'Tipo', type: 'select' as const, required: true, options: typeOptions },
  { name: 'legalEntityId', label: 'Entidad legal', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadLegalEntities },
  { name: 'counterpartyBpId', label: 'Contraparte (Business Partner)', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadBusinessPartners },
  { name: 'startDate', label: 'Fecha inicial', type: 'date' as const, required: true },
  { name: 'endDate', label: 'Fecha final', type: 'date' as const, optional: true },
  { name: 'currencyCode', label: 'Moneda', defaultValue: 'BOB', required: true, span: 2 as const },
];

export default function AccountingContractsPage() {
  const [recargar, setRecargar] = useState(0);

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
    // `recargar` fuerza una recarga cuando se agrega un término desde el panel de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargar]);

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
        { key: 'contractType', label: 'Tipo', options: typeOptions },
        { key: 'status', label: 'Estado' },
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
          { name: 'contractNo', label: 'Número de contrato', required: true },
          { name: 'contractType', label: 'Tipo', type: 'select', required: true, options: typeOptions },
          { name: 'startDate', label: 'Fecha inicial', type: 'date', required: true },
          { name: 'endDate', label: 'Fecha final', type: 'date', optional: true },
          { name: 'status', label: 'Estado', type: 'select', required: true, options: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED'].map((value) => ({ label: value, value })) },
        ],
        submit: (id, payload) => accountingService.updateContract(id, payload),
      }}
      remove={{
        submit: (id) => accountingService.deleteContract(id),
        warning: 'Se pierden también sus términos contractuales. Si el contrato ya facturó, márcalo como TERMINATED en vez de borrarlo.',
      }}
    >
      <InlineActionForm
        title="Agregar término contractual"
        description="Término estructurado con vigencia propia, colgado de un contrato ya registrado."
        icon="data_object"
        submitLabel="Agregar término"
        successMessage="El término quedó asociado al contrato."
        onDone={() => setRecargar((value) => value + 1)}
        onSubmit={(payload) => accountingService.createContractTerm({ ...payload, termValueJson: { value: payload.termValue }, termValue: undefined })}
        fields={[
          { name: 'contractId', label: 'Contrato', type: 'select', required: true, span: 2, optionsLoader: loadContracts },
          { name: 'termCode', label: 'Código del término', required: true },
          { name: 'termValue', label: 'Valor contractual', required: true },
          { name: 'effectiveFrom', label: 'Vigente desde', type: 'date', required: true },
          { name: 'effectiveTo', label: 'Vigente hasta', type: 'date', optional: true },
        ]}
      />
    </CrudDirectory>
  );
}
