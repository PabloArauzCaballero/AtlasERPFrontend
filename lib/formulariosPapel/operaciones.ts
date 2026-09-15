import type { FormSectionDefinition } from '@/components/screens/StructuredActionForm';
import { armarFormularioPapel, type FormularioPapel } from '@/lib/formularioPapel';
import {
  countryOptions,
} from '@/lib/catalogs';
import {
  loadAccountGroups,
  loadAccountingPeriods,
  loadB2BAccounts,
  loadBankAccounts,
  loadBusinessPartners,
  loadChartsOfAccounts,
  loadContracts2,
  loadGlAccounts,
  loadInternalUsers,
  loadLedgers,
  loadLegalEntities,
  loadModerationReasonCodes,
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
      { name: 'sourceSystem', label: 'Sistema origen', required: true, defaultValue: 'ATLAS_ERP', optionsSource: 'domain:accounting.documentSourceSystem' },
      { name: 'sourceType', label: 'Tipo origen', required: true, defaultValue: 'MANUAL', optionsSource: 'domain:accounting.documentSourceType' },
      { name: 'sourceId', label: 'ID origen', required: true },
      { name: 'documentType', label: 'Tipo documento', required: true, defaultValue: 'JOURNAL', optionsSource: 'domain:accounting.documentType' },
      { name: 'documentNo', label: 'Número documento', assignedByBackend: true },
      { name: 'currencyCode', label: 'Moneda', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' },
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
      { name: 'receiptNo', label: 'Número recibo', assignedByBackend: true },
      { name: 'receiptDate', label: 'Fecha recibo', type: 'date', required: true },
      { name: 'amount', label: 'Monto', type: 'number', required: true },
      { name: 'currencyCode', label: 'Moneda', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' },
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
      { name: 'proposalNumber', label: 'Número de propuesta', assignedByBackend: true },
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

// ---------------------------------------------------------------------------------------------
// Pantallas a mano sin líneas dinámicas: fichas y paneles.
// ---------------------------------------------------------------------------------------------

const SI_NO = [
  { label: 'Sí', value: 'true' },
  { label: 'No', value: 'false' },
];

export const SECCIONES_GRUPO_CUENTA: FormSectionDefinition[] = [
  {
    title: 'Nuevo grupo',
    description: 'Cree un grupo raíz o hijo (indicando el grupo padre).',
    fields: [
      { name: 'coaId', label: 'Plan de cuentas (COA)', type: 'select', required: true, optionsLoader: loadChartsOfAccounts, span: 2 },
      { name: 'parentGroupId', label: 'Grupo padre', type: 'select', optionsLoader: loadAccountGroups, hint: 'Vacío = grupo raíz' },
      { name: 'code', label: 'Código', required: true, placeholder: 'BG-ACT-CORR' },
      { name: 'sortOrder', label: 'Orden', type: 'number' },
      { name: 'name', label: 'Nombre', required: true, placeholder: 'Activo Corriente' },
      { name: 'statementType', label: 'Estado financiero', type: 'select', optionsSource: 'domain:accounting.statementType' },
      { name: 'classification', label: 'Clasificación', type: 'select', optionsSource: 'domain:accounting.accountClassification' },
      { name: 'subClassification', label: 'Subclasificación (opcional)', optional: true, optionsSource: 'domain:accounting.accountSubClassification' },
    ],
  },
];

export function formularioGrupoCuenta(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_GRUPO_CUENTA, {
    formCode: 'ERP-CONTABILIDAD-GRUPO-CUENTA-CREAR',
    title: 'Grupo de cuenta (árbol contable)',
    subtitle: 'Contabilidad · Grupos de cuenta · Jerarquía',
    signatures: FIRMAS_INTERNAS,
  });
}

export const SECCIONES_CUENTA_GL_EDICION: FormSectionDefinition[] = [
  {
    title: 'Edición de cuenta',
    description: 'Los identificadores contables (número, COA, tipo y naturaleza) son inmutables.',
    fields: [
      { name: 'accountNumber', label: 'Número de cuenta (la que se edita)', required: true },
      { name: 'name', label: 'Nombre', span: 2 },
      { name: 'status', label: 'Estado', type: 'select', optionsSource: 'domain:accounting.glAccountStatus' },
      { name: 'isPostingAllowed', label: 'Permite asientos', type: 'select', options: SI_NO },
      { name: 'isBankAccount', label: 'Es cuenta bancaria', type: 'select', options: SI_NO },
      { name: 'isReconcilable', label: 'Conciliable', type: 'select', options: SI_NO },
      { name: 'isCostCenterRequired', label: 'Exige centro de costo', type: 'select', options: SI_NO },
      { name: 'isProfitCenterRequired', label: 'Exige centro de beneficio', type: 'select', options: SI_NO },
    ],
  },
];

export function formularioCuentaGlEdicion(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_CUENTA_GL_EDICION, {
    formCode: 'ERP-CONTABILIDAD-CUENTA-GL-EDITAR',
    title: 'Cambios en una cuenta GL',
    subtitle: 'Contabilidad · Cuentas GL · Detalle',
    signatures: FIRMAS_INTERNAS,
  });
}

export const SECCIONES_PARTNER_EDICION: FormSectionDefinition[] = [
  {
    title: 'Edición de partner',
    description: 'El código y el tipo de partner son inmutables.',
    fields: [
      { name: 'partnerCode', label: 'Código del partner (el que se edita)', required: true },
      { name: 'legalName', label: 'Razón social', span: 2 },
      { name: 'tradeName', label: 'Nombre comercial' },
      { name: 'taxId', label: 'NIT / documento' },
      { name: 'countryCode', label: 'País', type: 'select', options: countryOptions },
      { name: 'kybStatus', label: 'Estado KYB', type: 'select', optionsSource: 'domain:accounting.kybStatus' },
      { name: 'status', label: 'Estado', type: 'select', optionsSource: 'domain:accounting.businessPartnerStatus' },
    ],
  },
];

export function formularioPartnerEdicion(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_PARTNER_EDICION, {
    formCode: 'ERP-CONTABILIDAD-PARTNER-EDITAR',
    title: 'Cambios en un business partner',
    subtitle: 'Contabilidad · Business partners · Detalle',
    signatures: FIRMAS_INTERNAS,
  });
}

export const SECCIONES_REGLA_MDR: FormSectionDefinition[] = [
  {
    title: 'Comisión por venta (MDR)',
    fields: [
      { name: 'contractVersionId', label: 'Contrato (versión vigente)', type: 'select', required: true, optionsLoader: loadContracts2, span: 3 },
      { name: 'ratePercent', label: 'Comisión (%)', type: 'number', required: true, placeholder: '3.50' },
      { name: 'productCategory', label: 'Categoría de producto', type: 'select', optionsSource: 'domain:crm.merchantCategory', hint: 'Vacío: aplica a todas.' },
      { name: 'riskSegment', label: 'Segmento de riesgo', type: 'select', optionsSource: 'domain:crm.riskTier', hint: 'Vacío: aplica a todos.' },
      { name: 'minFeeAmount', label: 'Piso (Bs)', type: 'number', hint: 'Una venta de Bs 20 al 3 % deja Bs 0,60.' },
      { name: 'maxFeeAmount', label: 'Techo (Bs)', type: 'number', hint: 'Evita comisiones desproporcionadas en ventas grandes.' },
    ],
  },
];

export function formularioReglaMdr(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_REGLA_MDR, {
    formCode: 'ERP-CRM-CONTRATO-REGLA-MDR',
    title: 'Regla de comisión por venta (MDR)',
    subtitle: 'CRM · Contratos · Comisión por venta',
    tablas: [
      {
        title: 'Más reglas para el mismo contrato',
        table: {
          columns: [
            { label: 'Comisión %', numeric: true },
            { label: 'Categoría', width: 2 },
            { label: 'Segmento de riesgo', width: 2 },
            { label: 'Piso (Bs)', numeric: true },
            { label: 'Techo (Bs)', numeric: true },
          ],
          rows: 6,
        },
      },
    ],
    signatures: [{ name: 'Ejecutivo comercial' }, { name: 'Aprobación', role: 'Gerencia comercial' }],
  });
}

export const SECCIONES_ACTIVIDAD_CUENTA: FormSectionDefinition[] = [
  {
    title: 'Actividad y tareas',
    description: 'Notas, llamadas, reuniones y tareas/recordatorios de la cuenta.',
    fields: [
      { name: 'accountId', label: 'Cuenta B2B', type: 'select', required: true, optionsLoader: loadB2BAccounts, span: 2 },
      {
        name: 'activityType',
        label: 'Tipo',
        type: 'select',
        options: [
          { label: 'Nota', value: 'NOTE' },
          { label: 'Llamada', value: 'CALL' },
          { label: 'Reunión', value: 'MEETING' },
          { label: 'Tarea', value: 'TASK' },
        ],
      },
      { name: 'dueAt', label: 'Vencimiento (para tareas)', type: 'datetime' },
      { name: 'subject', label: 'Asunto', required: true, span: 2, placeholder: 'Llamada de seguimiento, propuesta enviada…' },
      { name: 'description', label: 'Detalle', type: 'textarea', span: 3, placeholder: 'Notas de la interacción…' },
      { name: 'ownerUserId', label: 'Responsable', type: 'select', required: true, optionsLoader: loadInternalUsers },
    ],
  },
];

export function formularioActividadCuenta(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_ACTIVIDAD_CUENTA, {
    formCode: 'ERP-CRM-CUENTA-ACTIVIDAD',
    title: 'Actividad o tarea de una cuenta',
    subtitle: 'CRM · Cuentas · Detalle · Actividad y tareas',
    signatures: [{ name: 'Registrado por' }],
  });
}

export const SECCIONES_DECISION_MODERACION: FormSectionDefinition[] = [
  {
    title: 'Decisión de moderación',
    fields: [
      { name: 'creativeId', label: 'Creatividad revisada (identificador)', required: true, span: 2 },
      {
        name: 'reviewStatus',
        label: 'Decisión',
        type: 'select',
        required: true,
        optionsSource: 'domain:ads.moderationDecision',
      },
      { name: 'reasonCode', label: 'Código de motivo', required: true, span: 1, optionsLoader: loadModerationReasonCodes },
      { name: 'notes', label: 'Observaciones', type: 'textarea', span: 3 },
      { name: 'escalate', label: 'Escalar a supervisor', type: 'select', options: SI_NO },
    ],
  },
];

export function formularioDecisionModeracion(): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_DECISION_MODERACION, {
    formCode: 'ERP-ADS-MODERACION-DECIDIR',
    title: 'Decisión de moderación de una creatividad',
    subtitle: 'Ads · Moderación',
    signatures: [{ name: 'Moderador' }, { name: 'Supervisor (si escala)' }],
  });
}

export const SECCIONES_EVIDENCIA_REQUISITO: FormSectionDefinition[] = [
  {
    title: 'Evidencia de un requisito del expediente',
    fields: [
      { name: 'caseId', label: 'Caso de onboarding (número o comercio)', required: true, span: 2 },
      { name: 'checklistItemId', label: 'Requisito', required: true, hint: 'Tal como aparece en el checklist del caso.' },
      { name: 'nota', label: 'Qué se adjunta', type: 'textarea', span: 3 },
    ],
  },
];

export async function formularioEvidenciaRequisito(): Promise<FormularioPapel> {
  const formulario = await armarFormularioPapel(SECCIONES_EVIDENCIA_REQUISITO, {
    formCode: 'ERP-CRM-ONBOARDING-EVIDENCIA',
    title: 'Evidencia de requisito de onboarding',
    subtitle: 'CRM · Onboarding · Adjuntar evidencia',
    signatures: [{ name: 'Entregado por', role: 'Comercio' }, { name: 'Recibido por', role: 'Ejecutivo' }],
  });
  formulario.sections.push({
    title: 'Adjunto',
    fields: [{ label: 'Documento entregado (PDF, foto o fotocopia)', kind: 'file', required: true }],
  });
  return formulario;
}
