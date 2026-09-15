import type { FormSectionDefinition } from '@/components/screens/StructuredActionForm';
import { armarFormularioPapel, type FormularioPapel } from '@/lib/formularioPapel';
import { merchantCategoryOptions } from '@/lib/catalogs';

/**
 * Definiciones en papel de los formularios del PORTAL DEL COMERCIO.
 *
 * Estas pantallas no son declarativas —cada una pinta sus `<FormField>` a mano—, así que su
 * definición vive aquí, en el MISMO orden y con las MISMAS etiquetas que la pantalla. Es la única
 * copia que hay que mantener: el guardián `check-formularios-papel` exige que toda pantalla con
 * `<FormField>` tenga la suya. Si cambias un campo en la pantalla, cámbialo aquí; la versión
 * impresa en el papel cambia sola.
 */

const FIRMAS_COMERCIO = [
  { name: 'Firma del solicitante', role: 'Representante del comercio' },
  { name: 'Recibido por', role: 'Personal de ATLAS' },
];

const DECLARACION_COMERCIO = [
  'Declaro que los datos consignados son verdaderos y autorizo a ATLAS a verificarlos ante las entidades que corresponda.',
  'Este formulario será transcrito al sistema por personal autorizado; el número de serie impreso al pie identifica este papel.',
];

/** «Abrir expediente» + requisitos (matrícula, representante legal) + ficha comercial: el expediente completo. */
export const SECCIONES_EXPEDIENTE: FormSectionDefinition[] = [
  {
    title: 'Abrir expediente · Datos del comercio',
    fields: [
      { name: 'legalName', label: 'Razón social', required: true, span: 2 },
      { name: 'taxId', label: 'NIT', type: 'number', required: true, hint: 'Sólo dígitos.' },
      { name: 'tradeName', label: 'Nombre comercial', span: 2 },
      { name: 'commercialRegistry', label: 'Matrícula de comercio' },
      { name: 'businessCategory', label: 'Rubro del negocio', type: 'select', options: merchantCategoryOptions, span: 3 },
      { name: 'contactEmail', label: 'Correo de contacto', type: 'email', required: true, span: 2, hint: 'Ahí llegarán las credenciales del portal.' },
      { name: 'contactPhone', label: 'Teléfono' },
    ],
  },
  {
    title: 'Representante legal',
    description: 'Adjunte fotocopia del documento y, si firma por poder, el poder notarial.',
    fields: [
      { name: 'fullName', label: 'Nombre completo', required: true, span: 2, hint: 'Nombre y apellidos como figuran en el documento.' },
      {
        name: 'documentType',
        label: 'Tipo de documento',
        type: 'select',
        options: [
          { label: 'Cédula de identidad', value: 'ci' },
          { label: 'Pasaporte', value: 'passport' },
          { label: 'Documento extranjero', value: 'foreign_id' },
        ],
      },
      { name: 'documentNumber', label: 'Número de documento', required: true },
    ],
  },
];

export async function formularioExpediente(): Promise<FormularioPapel> {
  const formulario = await armarFormularioPapel(SECCIONES_EXPEDIENTE, {
    formCode: 'PORTAL-EXPEDIENTE-ABRIR',
    title: 'Solicitud de afiliación de comercio',
    subtitle: 'Portal del comercio · Mi empresa · Abrir expediente',
    instructions: [
      'Rellene los campos marcados con asterisco, en mayúsculas y con letra clara.',
      'Marque UN solo rubro. Si ninguno corresponde, marque «Otro».',
      'Adjunte fotocopia del NIT, del documento del representante legal y, si firma por poder, el poder notarial.',
      'Entregue el formulario en la oficina comercial de ATLAS o a su ejecutivo; le crearán el expediente y recibirá las credenciales del portal en el correo indicado.',
    ],
    declarations: DECLARACION_COMERCIO,
    signatures: FIRMAS_COMERCIO,
  });
  formulario.sections.push({
    title: 'Documentos que adjunta',
    fields: [
      { label: 'Fotocopia del NIT', kind: 'file', required: true },
      { label: 'Documento del representante legal', kind: 'file', required: true },
      { label: 'Poder notarial (si firma por poder)', kind: 'file' },
    ],
  });
  return formulario;
}

/** Sucursales y cajas: una tabla para varias sucursales y otra para sus cajas. */
export const SECCIONES_SUCURSAL: FormSectionDefinition[] = [
  {
    title: 'Agregar sucursal',
    description: 'Registra un local nuevo de tu negocio. Nace activo; vender a crédito en él lo habilita Atlas aparte.',
    fields: [
      { name: 'name', label: 'Nombre de sucursal', required: true, placeholder: 'Sucursal Norte' },
      { name: 'city', label: 'Ciudad', optionsSource: 'catalog:city' },
      { name: 'address', label: 'Dirección', type: 'address', span: 3, placeholder: 'Av. principal, zona y referencia' },
    ],
  },
  {
    title: 'Registrar caja en esta sucursal',
    fields: [
      { name: 'terminalSerial', label: 'Serial de la caja', required: true, span: 2 },
      { name: 'terminalAlias', label: 'Alias', hint: 'Caja 1, Mostrador…' },
    ],
  },
];

export function formularioSucursales(comercio?: string): Promise<FormularioPapel> {
  return armarFormularioPapel(SECCIONES_SUCURSAL, {
    formCode: 'PORTAL-SUCURSAL-REGISTRAR',
    title: 'Alta de sucursal y cajas',
    subtitle: 'Portal del comercio · Sucursales',
    ...(comercio ? { context: [{ label: 'Comercio', value: comercio }] } : {}),
    tablas: [
      {
        title: 'Más sucursales (una por renglón)',
        description: 'Si registra varias sucursales de una vez, use esta tabla en vez de repetir el formulario.',
        table: {
          columns: [
            { label: 'Nombre de sucursal', width: 2 },
            { label: 'Ciudad', width: 1 },
            { label: 'Dirección', width: 3 },
            { label: 'Cajas (seriales)', width: 2 },
          ],
          rows: 8,
        },
      },
    ],
    declarations: DECLARACION_COMERCIO,
    signatures: FIRMAS_COMERCIO,
  });
}

/** Abrir un caso de soporte. Los motivos vienen del backend: se pasan ya aplanados. */
export function formularioSoporte(
  motivos: Array<{ label: string; value: string }>,
  comercio?: string,
): Promise<FormularioPapel> {
  const secciones: FormSectionDefinition[] = [
    {
      title: 'Abrir un caso',
      description: 'Cuéntanos qué pasa por escrito; lo seguimos desde tus casos.',
      fields: [
        { name: 'motivoDelCaso', label: 'Motivo', type: 'select', required: true, options: motivos, span: 3 },
        { name: 'tituloDelCaso', label: 'Título', required: true, span: 3, placeholder: 'Qué pasa, en una línea' },
        { name: 'descripcionDelCaso', label: 'Descripción', type: 'textarea', required: true, span: 3 },
        { name: 'contacto', label: 'Teléfono o correo para responderle', span: 2 },
        { name: 'fecha', label: 'Fecha del problema', type: 'date' },
      ],
    },
  ];
  return armarFormularioPapel(secciones, {
    formCode: 'PORTAL-SOPORTE-ABRIR-CASO',
    title: 'Solicitud de soporte',
    subtitle: 'Portal del comercio · Soporte · Abrir un caso',
    ...(comercio ? { context: [{ label: 'Comercio', value: comercio }] } : {}),
    signatures: [{ name: 'Firma de quien reporta' }, { name: 'Recibido por', role: 'Soporte ATLAS' }],
  });
}

/** Registrar el QR de cobro bancario. La IMAGEN no se transcribe: se adjunta impresa. */
export const SECCIONES_QR_COBRO: FormSectionDefinition[] = [
  {
    title: 'QR bancario de cobro',
    description: 'El QR con el que sus clientes le pagan cada cuota. El dinero entra en su cuenta, no en la de Atlas.',
    fields: [
      { name: 'bankInstitutionCode', label: 'Entidad (sigla ASFI)', required: true, optionsSource: 'domain:portal.bankInstitution' },
      { name: 'accountNumberMasked', label: 'Cuenta enmascarada', hint: '****7890' },
      { name: 'titular', label: 'Titular de la cuenta', span: 3 },
    ],
  },
];

export async function formularioQrCobro(comercio?: string): Promise<FormularioPapel> {
  const formulario = await armarFormularioPapel(SECCIONES_QR_COBRO, {
    formCode: 'PORTAL-QR-COBRO-REGISTRAR',
    title: 'Registro del QR de cobro',
    subtitle: 'Portal del comercio · Mi QR de cobro',
    ...(comercio ? { context: [{ label: 'Comercio', value: comercio }] } : {}),
    instructions: [
      'Pegue o grape en este formulario el QR impreso por su banco, nítido y sin recortes: es la imagen que se registrará.',
      'Escriba la sigla de la entidad y los últimos cuatro dígitos de la cuenta para que ATLAS compruebe que el QR es suyo.',
    ],
    declarations: [
      'Declaro que la cuenta asociada al QR adjunto pertenece a este comercio y autorizo a ATLAS a verificarlo con la entidad financiera.',
    ],
    signatures: FIRMAS_COMERCIO,
  });
  formulario.sections.push({
    title: 'Imagen del QR (pegar aquí)',
    fields: [{ label: 'QR bancario impreso, pegado o grapado en este espacio', kind: 'file', required: true }],
    table: { columns: [{ label: 'Espacio para el QR' }], rows: 6 },
  });
  return formulario;
}
