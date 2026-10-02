import type { FormSectionDefinition } from '@/components/screens/StructuredActionForm';
import { loadInternalUsers } from '@/services/optionLoaders';
import { TAMANO_MAXIMO_EVIDENCIA } from '@/services/filesService';

/** Etiqueta de la opción vacía de los selects opcionales de esta alta. */
export const SIN_ESPECIFICAR = '— Sin especificar —';

const optionalSelect = <T extends { label: string; value: string }>(options: T[]) => [
  { label: SIN_ESPECIFICAR, value: '' },
  ...options,
];

/**
 * Los campos del alta de una empresa (cuenta B2B), en un módulo aparte.
 *
 * Los usan DOS sitios: el formulario de `/operaciones/crm/cuentas/crear` y la carga masiva del
 * directorio de Cuentas B2B. Vivían dentro de la página de alta, y por eso el listado —el más
 * usado del ERP— no tenía forma de ofrecer «Importar»: le faltaba de dónde sacar la plantilla.
 * Definidos una vez, la plantilla del Excel no se puede desfasar del formulario.
 *
 * `countryCity` y `address` son los dos campos que no se comportan igual en una hoja de cálculo:
 * el primero se desdobla en dos columnas (país y ciudad) y el segundo se queda fuera, porque
 * compone la dirección con un mapa. Eso lo resuelve `ExcelImportModal`, no esta lista.
 */
/**
 * Los datos del expediente del comercio, pedidos UNA vez.
 *
 * Hasta el 2026-10-02 el ERP registraba la empresa, abría su onboarding y el expediente nacía en
 * Atlas con «Falta 4 requisitos»: matrícula, representante legal con poder, una sucursal y el QR de
 * cobro. El comercio tenía que volver a entregarlos en su portal. Pablo: «el usuario te lo pasa una
 * vez y esto debe estar listo y cargado». Aquí son opcionales —un prospecto no tiene QR— y se exigen
 * al abrir el onboarding; la casa matriz ya se pide arriba y es la primera sucursal. Los archivos
 * (`poderNotarial`, `qrBancario`) no van en el JSON: la pantalla los sube al almacén como documentos
 * de la cuenta y manda sus ids. Lo usa también el detalle de la cuenta para completar lo que falte.
 */
export const seccionDatosDelExpediente: FormSectionDefinition = {
  title: 'Datos del expediente', icon: 'fact_check', description: 'Lo que el expediente del comercio exige para activarse. Se pide una sola vez, aquí, y llega hecho a su portal.', fields: [
    { name: 'dossier.commercialRegistry', label: 'Matrícula de comercio', tooltip: 'Número de matrícula en el registro de comercio (Fundempresa/SEPREC); acredita que la empresa existe legalmente.', optional: true, placeholder: 'Número tal como figura en el certificado', hint: 'Figura en el certificado de matrícula de comercio.' },
    { name: 'dossier.legalRepFullName', label: 'Representante legal', tooltip: 'Nombre y apellidos completos de quien firma por la empresa, como en su documento de identidad.', optional: true, placeholder: 'Nombre y apellidos', span: 2 },
    { name: 'dossier.legalRepDocumentType', label: 'Documento del representante', tooltip: 'Tipo de documento de identidad del representante legal; decide el formato del número.', type: 'select', optional: true, optionsSource: 'domain:crm.legalRepDocumentType', emptyOption: SIN_ESPECIFICAR },
    { name: 'dossier.legalRepDocumentNumber', label: 'Número de documento', tooltip: 'Número del documento del representante tal como aparece impreso, sin puntos.', optional: true, placeholder: 'Sólo el número, sin puntos' },
    { name: 'poderNotarial', label: 'Poder notarial', tooltip: 'El poder notarial escaneado que acredita que el representante firma por la empresa. Va a la carpeta «documentos» del comercio.', type: 'file', accept: 'application/pdf,image/jpeg,image/png', maxBytes: TAMANO_MAXIMO_EVIDENCIA, optional: true, hint: 'PDF o imagen hasta 15 MB. Sin él el expediente no se puede enviar a revisión.', span: 2 },
    { name: 'dossier.bankInstitutionCode', label: 'Entidad del QR de cobro', tooltip: 'Banco o entidad financiera (sigla ASFI) de la cuenta a la que cobra el comercio.', type: 'select', optional: true, optionsSource: 'domain:portal.bankInstitution', emptyOption: SIN_ESPECIFICAR },
    { name: 'dossier.bankAccountMasked', label: 'Cuenta del QR (enmascarada)', tooltip: 'Últimos dígitos de la cuenta bancaria del QR; el expediente prueba de quién es, no la opera.', optional: true, placeholder: 'Terminación de la cuenta', hint: 'Sólo los últimos dígitos, p. ej. los cuatro finales.' },
    { name: 'qrBancario', label: 'QR bancario de cobro', tooltip: 'Imagen del QR bancario con el que el comercio cobra. Lo confirma el propio comercio y sus clientes lo ven al activarse.', type: 'file', accept: 'image/jpeg,image/png', maxBytes: 5 * 1024 * 1024, optional: true, hint: 'PNG o JPG hasta 5 MB, el código tal como lo entrega el banco: ni foto del local ni captura de pantalla.', span: 2 },
  ],
};

/**
 * En el ALTA los datos del expediente son obligatorios por defecto (Pablo, 2026-10-02: «que pida
 * todos estos datos como requisitos obligatorios por defecto»). En el detalle de la cuenta se usa la
 * misma sección opcional, para completar sólo lo que falte en cuentas anteriores o importadas.
 */
const seccionDatosDelExpedienteObligatoria: FormSectionDefinition = {
  ...seccionDatosDelExpediente,
  fields: seccionDatosDelExpediente.fields.map((field) => ({ ...field, optional: false, required: true })),
};

export const seccionesAltaCuentaB2b: FormSectionDefinition[] = [
  {
    title: 'Datos de la empresa', icon: 'domain', description: 'Quién es la empresa y a qué se dedica.', fields: [
      { name: 'legalName', label: 'Razón social', tooltip: 'Nombre legal tal como figura en el NIT o en el registro de comercio; es el que va en facturas y contratos.', required: true, placeholder: 'Empresa Ejemplo S.R.L.', span: 2 },
      { name: 'tradeName', label: 'Nombre comercial', tooltip: 'Nombre con el que el negocio se presenta al público, si es distinto del legal. Ej.: «Tienda Doña Rosa».', required: true, placeholder: 'Marca Ejemplo' },
      { name: 'taxId', label: 'NIT', tooltip: 'NIT (o CI si es persona natural) sin puntos ni guiones, de 7 a 15 dígitos. Ej.: 1023456019. Sin él Atlas no abre la carpeta del comercio ni se puede iniciar su onboarding.', required: true, placeholder: '1023456019', hint: 'De 7 a 15 dígitos, sin puntos ni guiones.' },
      /* Los valores válidos los publica el backend. La lista local ofrecía ENTERPRISE, que el
         esquema rechaza, y no tenía DISTRIBUTOR ni FINANCIAL_ALLY. */
      { name: 'accountType', label: 'Tipo de cuenta', tooltip: 'Tipo de cuenta B2B; agrupa la cartera por tipo de comercio y decide qué reglas aplican.', type: 'select', required: true, defaultValue: 'MERCHANT', optionsSource: 'domain:crm.accountType' },
      { name: 'industry', label: 'Industria', tooltip: 'Sector económico del comercio; sirve para segmentar la cartera.', type: 'select', optional: true, optionsSource: 'domain:crm.industry', emptyOption: SIN_ESPECIFICAR },
      { name: 'category', label: 'Categoría comercial', tooltip: 'Categoría comercial dentro de su industria; afina las reglas de comisión.', type: 'select', required: true, optionsSource: 'domain:crm.merchantCategory', hint: 'Catálogo cerrado: es lo que agrupa la cartera por tipo de comercio.' },
      { name: 'businessLine', label: 'Rubro / actividad principal', tooltip: 'Qué vende exactamente el comercio. Ej.: Farmacia, Restaurante.', type: 'select', required: true, optionsSource: 'domain:crm.businessLine', hint: 'Qué vende exactamente el comercio.' },
      { name: 'businessDescription', label: 'Descripción del negocio', tooltip: 'Descripción breve del negocio para quien lo visite después.', type: 'textarea', optional: true, placeholder: 'Actividad, propuesta de valor y mercado objetivo...', span: 3 },
      { name: 'tags', label: 'Tags de clasificación', tooltip: 'Etiquetas libres para filtrar la cartera. Escribe cada una y pulsa Enter.', type: 'chips', valueKind: 'stringList', optional: true, placeholder: 'mayorista, omnicanal, pyme', hint: 'Escribe cada tag y pulsa Enter.' },
      { name: 'websiteUrl', label: 'Sitio web', tooltip: 'Dirección web pública del anunciante, con https://. Sirve para verificar la marca antes de aprobar creatividades.', type: 'url', optional: true, placeholder: 'https://empresa.com' },
      /* País y ciudad en un árbol con banderas: elegir la ciudad fija el país, y nunca quedan incoherentes. */
      { name: 'countryCode', label: 'País y ciudad', tooltip: 'País de residencia fiscal del socio; decide qué documento tributario se le exige.', type: 'countryCity', cityFieldName: 'city', required: true, defaultValue: 'BO', hint: 'Elige la ciudad dentro de su país. Si no está, escríbela en «Otra ciudad».' },
      { name: 'address', label: 'Casa matriz', tooltip: 'Dirección completa de la casa matriz; es la primera sucursal del comercio. Pulsa el pin para verla en el mapa.', type: 'address', cityFieldName: 'city', countryFieldName: 'countryCode', required: true, span: 2, placeholder: 'Calle, número, zona...', hint: 'Pulsa el pin (o Enter) para verla en Google Maps.' },
      { name: 'employeeCount', label: 'Cantidad de empleados', tooltip: 'Número aproximado de empleados; dimensiona el negocio.', type: 'number', valueKind: 'number', optional: true },
      { name: 'foundedYear', label: 'Año de fundación', tooltip: 'Año de fundación en cuatro cifras. Ej.: 2015.', type: 'number', valueKind: 'number', optional: true },
      { name: 'annualRevenue', label: 'Facturación anual (BOB)', tooltip: 'Facturación anual estimada en bolivianos.', type: 'number', valueKind: 'number', optional: true },
      /* Nadie sabe de memoria un UUID: el responsable se ELIGE de la lista de usuarios internos. */
      { name: 'ownerUserId', label: 'Ejecutivo responsable', tooltip: 'Ejecutivo comercial que responde por esta cuenta; recibe las tareas y los avisos.', type: 'select', optional: true, optionsLoader: async () => optionalSelect(await loadInternalUsers()) },
      { name: 'riskTier', label: 'Nivel de riesgo inicial', tooltip: 'Nivel de riesgo inicial del comercio; decide límites y revisión.', type: 'select', optional: true, optionsSource: 'domain:crm.riskTier', emptyOption: SIN_ESPECIFICAR },
      { name: 'expectedMonthlyVolume', label: 'Volumen mensual esperado (BOB)', tooltip: 'Ventas mensuales estimadas en bolivianos; dimensiona la oportunidad.', type: 'number', valueKind: 'number', optional: true, placeholder: '150000' },
      { name: 'notes', label: 'Notas comerciales', tooltip: 'Notas comerciales libres: contexto de la relación, acuerdos verbales.', type: 'textarea', optional: true, placeholder: 'Contexto, referencias y observaciones...', span: 3 },
    ],
  },
    {
    title: 'Persona de contacto', icon: 'contact_page', description: 'Con quién se coordina en la empresa.', fields: [
      { name: 'primaryContact.fullName', label: 'Nombre completo', tooltip: 'Nombre y apellidos completos de la persona, como en su documento de identidad.', required: true, placeholder: 'Nombre y apellido', span: 2 },
      { name: 'primaryContact.roleTitle', label: 'Cargo', tooltip: 'Cargo que ocupa en la empresa; ayuda a saber a quién dirigirse en cada tema.', type: 'select', optional: true, optionsSource: 'domain:crm.contactRoleTitle', emptyOption: SIN_ESPECIFICAR, hint: 'Qué puesto ocupa en la empresa.' },
      { name: 'primaryContact.email', label: 'Correo', tooltip: 'Correo de la persona, para contactarla e identificarla. El sistema no le envía avisos automáticos. Ej.: nombre@empresa.bo.', type: 'email', optional: true, placeholder: 'contacto@empresa.com' },
      { name: 'primaryContact.phone', label: 'Teléfono', tooltip: 'Teléfono con código de país, sin espacios. Ej.: +59170012345.', optional: true, placeholder: '+591 7...' },
      { name: 'primaryContact.decisionRole', label: 'Peso en la decisión', tooltip: 'Cuánto pesa esta persona en la decisión de compra; orienta a quién hay que convencer.', type: 'select', optional: true, optionsSource: 'domain:crm.decisionRole', emptyOption: SIN_ESPECIFICAR, hint: 'Si decide la compra o solo influye. Ayuda a saber a quién convencer.' },
    ],
  },
  seccionDatosDelExpedienteObligatoria,
];
