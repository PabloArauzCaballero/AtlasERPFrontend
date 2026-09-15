import type { FormSectionDefinition } from '@/components/screens/StructuredActionForm';
import { armarFormularioPapel, type FormularioPapel } from '@/lib/formularioPapel';
import {
  loadAccountingPeriods,
  loadB2BAccounts,
  loadBankAccounts,
  loadBusinessPartners,
  loadGlAccounts,
  loadInternalUsers,
  loadLedgers,
  loadLegalEntities,
  loadOpportunities,
} from '@/services/optionLoaders';

/**
 * Definiciones en papel de las pantallas del ERP interno hechas A MANO: las cuatro con líneas
 * dinámicas (asiento, recibo, propuesta, caso de onboarding). Mismo orden y mismas etiquetas que
 * la pantalla; los catálogos del backend se resuelven al pulsar y salen como anexo.
 */

const FIRMAS_INTERNAS = [
  { name: 'Elaborado por', role: 'Quien rellena el formulario' },
  { name: 'Revisado por', role: 'Responsable del área' },
];

export const SECCIONES_DOCUMENTO_CONTABLE: FormSectionDefinition[] = [
  {
    title: 'Datos de cabecera',
    fields: [
      { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, optionsLoader: loadLegalEntities, span: 2 },
      { name: 'sourceSystem', label: 'Sistema origen', required: true, defaultValue: 'ATLAS_ERP' },
      { name: 'sourceType', label: 'Tipo origen', required: true, defaultValue: 'MANUAL' },
      { name: 'sourceId', label: 'ID origen', required: true },
      { name: 'documentType', label: 'Tipo documento', required: true, defaultValue: 'JOURNAL' },
      { name: 'documentNo', label: 'Número documento', required: true },
      { name: 'currencyCode', label: 'Moneda', required: true, defaultValue: 'BOB' },
      { name: 'documentDate', label: 'Fecha documento', type: 'date', required: true },
      { name: 'postingDate', label: 'Fecha contabilización', type: 'date', required: true },
      { name: 'accountingPeriodId', label: 'Período contable', type: 'select', required: true, optionsLoader: loadAccountingPeriods },
      { name: 'ledgerId', label: 'Ledger', type: 'select', required: true, optionsLoader: loadLedgers },
      {
        name: 'approvalStatus',
        label: 'Aprobación',
        type: 'select',
        options: [
          { label: 'No requerida', value: 'NOT_REQUIRED' },
          { label: 'Pendiente', value: 'PENDING' },
          { label: 'Aprobada', value: 'APPROVED' },
        ],
      },
    ],
  },
  {
    title: 'Catálogos de las líneas',
    description: 'Sólo para que el anexo traiga las cuentas y partners vigentes; las líneas van en la tabla.',
    fields: [
      { name: 'glAccountId', label: 'Cuenta GL (para las líneas)', type: 'select', optionsLoader: loadGlAccounts, span: 2 },
      { name: 'partnerId', label: 'Partner (para las líneas)', type: 'select', optionsLoader: loadBusinessPartners },
    ],
  },
];

export function formularioDocumentoContable(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_DOCUMENTO_CONTABLE, {
    formCode: 'ERP-CONTABILIDAD-DOCUMENTO-CREAR',
    title: 'Documento contable (asiento)',
    subtitle: 'Contabilidad · Documentos · Crear documento',
    instructions: [
      'Un asiento tiene al menos dos líneas y el total del Debe debe ser igual al del Haber.',
      'En «Cuenta GL» y «Partner» escriba el CÓDIGO del anexo correspondiente.',
      'Importes en la moneda indicada, con dos decimales.',
    ],
    tablas: [
      {
        title: 'Líneas del asiento',
        table: {
          columns: [
            { label: 'Cuenta GL (código)', width: 2 },
            { label: 'Debe', width: 1, numeric: true },
            { label: 'Haber', width: 1, numeric: true },
            { label: 'Descripción', width: 3 },
            { label: 'Partner (código)', width: 1 },
            { label: 'Centro de costo', width: 1 },
          ],
          rows: 12,
          totalRow: true,
        },
      },
    ],
    signatures: FIRMAS_INTERNAS,
  });
}

export const SECCIONES_RECIBO: FormSectionDefinition[] = [
  {
    title: 'Detalles del documento',
    fields: [
      { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, optionsLoader: loadLegalEntities, span: 2 },
      { name: 'payerBpId', label: 'Pagador (Business Partner)', type: 'select', required: true, optionsLoader: loadBusinessPartners, span: 2 },
      { name: 'receiptNo', label: 'Número recibo', required: true },
      { name: 'receiptDate', label: 'Fecha recibo', type: 'date', required: true },
      { name: 'amount', label: 'Monto', type: 'number', required: true },
      { name: 'currencyCode', label: 'Moneda', required: true, defaultValue: 'BOB' },
      { name: 'bankAccountId', label: 'Cuenta bancaria', type: 'select', optionsLoader: loadBankAccounts },
      { name: 'bankGlAccountId', label: 'Cuenta GL banco', type: 'select', required: true, optionsLoader: loadGlAccounts },
      { name: 'arControlGlAccountId', label: 'Cuenta GL control AR', type: 'select', required: true, optionsLoader: loadGlAccounts },
      { name: 'accountingPeriodId', label: 'Período contable', type: 'select', required: true, optionsLoader: loadAccountingPeriods },
      { name: 'ledgerId', label: 'Ledger', type: 'select', required: true, optionsLoader: loadLedgers },
    ],
  },
];

export function formularioRecibo(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_RECIBO, {
    formCode: 'ERP-CONTABILIDAD-RECIBO-REGISTRAR',
    title: 'Recibo contable',
    subtitle: 'Contabilidad · Recibos · Registrar recibo',
    instructions: [
      'La suma de los montos aplicados debe coincidir exactamente con el monto del recibo.',
      'Identifique cada factura AR por su número; quien transcribe la buscará en el sistema.',
    ],
    tablas: [
      {
        title: 'Asignación de facturas (AR)',
        table: {
          columns: [
            { label: 'Factura AR (número)', width: 3 },
            { label: 'Monto aplicado', width: 1, numeric: true },
          ],
          rows: 8,
          totalRow: true,
        },
      },
    ],
    signatures: FIRMAS_INTERNAS,
  });
}

export const SECCIONES_PROPUESTA: FormSectionDefinition[] = [
  {
    title: 'Cabecera',
    fields: [
      { name: 'opportunityId', label: 'Oportunidad', type: 'select', required: true, optionsLoader: loadOpportunities, span: 2 },
      { name: 'proposalNumber', label: 'Número de propuesta', required: true, placeholder: 'CP-2026-001' },
      { name: 'validUntil', label: 'Válida hasta', type: 'date' },
      { name: 'totalEstimatedMonthlyRevenue', label: 'Ingreso mensual estimado', type: 'number' },
    ],
  },
  {
    title: 'Excepción de tarifa',
    fields: [
      { name: 'pricingExceptionReason', label: 'Justificación de excepción', type: 'textarea', span: 3, placeholder: 'Explique cualquier condición fuera de la política comercial estándar.' },
    ],
  },
];

export function formularioPropuesta(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_PROPUESTA, {
    formCode: 'ERP-CRM-PROPUESTA-CREAR',
    title: 'Propuesta comercial',
    subtitle: 'CRM · Propuestas · Nueva propuesta',
    instructions: [
      'Cada término comercial va en un renglón: tipo (COMISION, TARIFA_FIJA, MINIMO…), tasa o monto, y cómo se factura.',
      'Los importes en bolivianos con dos decimales; las tasas en porcentaje.',
    ],
    tablas: [
      {
        title: 'Términos comerciales',
        table: {
          columns: [
            { label: 'Tipo', width: 1 },
            { label: 'Descripción', width: 3 },
            { label: 'Tasa %', width: 1, numeric: true },
            { label: 'Monto fijo', width: 1, numeric: true },
            { label: 'Facturación', width: 1 },
            { label: 'Mínimo mensual', width: 1, numeric: true },
          ],
          rows: 10,
        },
      },
    ],
    signatures: [
      { name: 'Ejecutivo comercial' },
      { name: 'Aprobación (si hay excepción)', role: 'Gerencia comercial' },
    ],
  });
}

export const SECCIONES_CASO_ONBOARDING: FormSectionDefinition[] = [
  {
    title: 'El comercio y quién responde',
    fields: [
      { name: 'accountId', label: 'Comercio', type: 'select', required: true, optionsLoader: loadB2BAccounts, span: 2, hint: 'Cuentas B2B registradas en el directorio.' },
      { name: 'ownerUserId', label: 'Ejecutivo responsable', type: 'select', required: true, optionsLoader: loadInternalUsers, hint: 'Quien responde por el alta ante Legal y Operaciones.' },
    ],
  },
];

export function formularioCasoOnboarding(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_CASO_ONBOARDING, {
    formCode: 'ERP-CRM-ONBOARDING-CASO-CREAR',
    title: 'Caso de onboarding de comercio',
    subtitle: 'CRM · Onboarding · Nuevo caso',
    instructions: [
      'Al menos un requisito, verificable. Mientras quede uno pendiente, el comercio no se activa.',
      'Tipo de requisito: LEGAL, OPERATIONS, TECHNICAL o FINANCE.',
    ],
    tablas: [
      {
        title: 'Requisitos del expediente',
        table: {
          columns: [
            { label: 'Tipo (LEGAL / OPERATIONS / TECHNICAL / FINANCE)', width: 1 },
            { label: 'Descripción del requisito', width: 3 },
          ],
          rows: 8,
        },
      },
    ],
    signatures: FIRMAS_INTERNAS,
  });
}
