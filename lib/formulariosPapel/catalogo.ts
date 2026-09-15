import type { FormularioPapel } from '@/lib/formularioPapel';
import {
  formularioActividadCuenta,
  formularioCasoOnboarding,
  formularioCuentaGlEdicion,
  formularioDecisionModeracion,
  formularioDocumentoContable,
  formularioEvidenciaRequisito,
  formularioGrupoCuenta,
  formularioPartnerEdicion,
  formularioPropuesta,
  formularioRecibo,
  formularioReglaMdr,
} from './operaciones';
import { formularioExpediente, formularioQrCobro, formularioSoporte, formularioSucursales } from './portal';

/**
 * Catálogo de formularios en papel que se pueden imprimir desde una sola pantalla.
 *
 * Es lo que un comercio o una oficina se lleva al mostrador: el cuaderno entero de una vez. Sólo
 * lista los formularios con definición propia (los hechos a mano); los declarativos se imprimen
 * desde su propia pantalla, donde el botón sale solo. `href` es la pantalla donde se transcribe.
 */
export interface EntradaCatalogoPapel {
  formCode: string;
  title: string;
  modulo: string;
  href: string;
  formulario: () => Promise<FormularioPapel>;
}

export const CATALOGO_PORTAL: EntradaCatalogoPapel[] = [
  { formCode: 'PORTAL-EXPEDIENTE-ABRIR', title: 'Solicitud de afiliación de comercio (expediente)', modulo: 'Mi empresa', href: '/portal-comercio/expediente', formulario: formularioExpediente },
  { formCode: 'PORTAL-SUCURSAL-REGISTRAR', title: 'Alta de sucursal y cajas', modulo: 'Sucursales', href: '/portal-comercio/sucursales-usuarios', formulario: () => formularioSucursales() },
  { formCode: 'PORTAL-QR-COBRO-REGISTRAR', title: 'Registro del QR de cobro', modulo: 'Mi QR de cobro', href: '/portal-comercio/qr-cobro', formulario: () => formularioQrCobro() },
  { formCode: 'PORTAL-SOPORTE-ABRIR-CASO', title: 'Solicitud de soporte', modulo: 'Soporte', href: '/portal-comercio/soporte', formulario: () => formularioSoporte([]) },
];

export const CATALOGO_OPERACIONES: EntradaCatalogoPapel[] = [
  { formCode: 'ERP-CRM-PROPUESTA-CREAR', title: 'Propuesta comercial', modulo: 'CRM', href: '/operaciones/crm/propuestas/crear', formulario: formularioPropuesta },
  { formCode: 'ERP-CRM-ONBOARDING-CASO-CREAR', title: 'Caso de onboarding de comercio', modulo: 'CRM', href: '/operaciones/crm/onboarding/crear', formulario: formularioCasoOnboarding },
  { formCode: 'ERP-CRM-ONBOARDING-EVIDENCIA', title: 'Evidencia de requisito de onboarding', modulo: 'CRM', href: '/operaciones/crm/onboarding', formulario: formularioEvidenciaRequisito },
  { formCode: 'ERP-CRM-CONTRATO-REGLA-MDR', title: 'Regla de comisión por venta (MDR)', modulo: 'CRM', href: '/operaciones/crm/contratos', formulario: formularioReglaMdr },
  { formCode: 'ERP-CRM-CUENTA-ACTIVIDAD', title: 'Actividad o tarea de una cuenta', modulo: 'CRM', href: '/operaciones/crm/cuentas', formulario: formularioActividadCuenta },
  { formCode: 'ERP-CONTABILIDAD-DOCUMENTO-CREAR', title: 'Documento contable (asiento)', modulo: 'Contabilidad', href: '/operaciones/contabilidad/documentos/crear', formulario: formularioDocumentoContable },
  { formCode: 'ERP-CONTABILIDAD-RECIBO-REGISTRAR', title: 'Recibo contable', modulo: 'Contabilidad', href: '/operaciones/contabilidad/recibos/crear', formulario: formularioRecibo },
  { formCode: 'ERP-CONTABILIDAD-GRUPO-CUENTA-CREAR', title: 'Grupo de cuenta (árbol contable)', modulo: 'Contabilidad', href: '/operaciones/contabilidad/grupos-cuenta', formulario: formularioGrupoCuenta },
  { formCode: 'ERP-CONTABILIDAD-CUENTA-GL-EDITAR', title: 'Cambios en una cuenta GL', modulo: 'Contabilidad', href: '/operaciones/contabilidad/cuentas-gl', formulario: formularioCuentaGlEdicion },
  { formCode: 'ERP-CONTABILIDAD-PARTNER-EDITAR', title: 'Cambios en un business partner', modulo: 'Contabilidad', href: '/operaciones/contabilidad/business-partners', formulario: formularioPartnerEdicion },
  { formCode: 'ERP-ADS-MODERACION-DECIDIR', title: 'Decisión de moderación de una creatividad', modulo: 'Ads', href: '/operaciones/ads/moderacion', formulario: formularioDecisionModeracion },
];
