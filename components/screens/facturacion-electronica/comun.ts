import type { StatusTone } from '@/lib/formatters';
import type { Option } from '@/services/optionLoaders';

/** `{ código: etiqueta }` a partir de las opciones de un dominio. */
export function etiquetas(opciones: readonly Option[]): Record<string, string> {
  return Object.fromEntries(opciones.map((opcion) => [opcion.value, opcion.label]));
}

/**
 * Color del estado ante Impuestos. La regla general (`statusTone`) no conoce estos códigos: dejaba
 * «Error de envío» y «Observada» en gris, como si no hubiera nada que mirar.
 */
export function toneSiat(code: string): StatusTone {
  if (code === 'ACCEPTED') return 'success';
  if (code === 'ERROR' || code === 'REJECTED' || code === 'VOIDED') return 'danger';
  if (code === 'OBSERVED' || code === 'PENDING') return 'warning';
  return 'neutral';
}

/** Contingencia: abierta es lo que hay que vigilar; con paquetes enviados, cerrada del todo. */
export function toneEvento(code: string): StatusTone {
  if (code === 'OPEN') return 'danger';
  if (code === 'DISPATCHED') return 'success';
  return 'warning';
}

const fechaHora = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/La_Paz',
});

/** Fecha y hora de La Paz: una vigencia de CUFD dura horas, el día solo no basta. */
export function formatoFechaHora(valor: unknown): string {
  if (!valor) return '—';
  const fecha = new Date(String(valor));
  return Number.isNaN(fecha.getTime()) ? '—' : fechaHora.format(fecha);
}

/**
 * Los catálogos que publica Impuestos, con el nombre con el que se reconocen. El código es el del
 * sistema; la etiqueta y la ayuda son para quien elige cuál mirar.
 */
export const CATALOGOS_SIN: Option[] = [
  { value: 'ACTIVIDADES', label: 'Actividades económicas', description: 'Actividades registradas del contribuyente (código CAEB).' },
  { value: 'ACTIVIDADES_DOC_SECTOR', label: 'Actividades por documento sector', description: 'Qué tipo de factura corresponde a cada actividad.' },
  { value: 'LEYENDAS', label: 'Leyendas de factura', description: 'Las leyendas de la Ley 453 que Impuestos exige imprimir, por actividad.' },
  { value: 'PRODUCTOS', label: 'Productos y servicios', description: 'Códigos de producto del SIN que se asignan a cada línea facturada.' },
  { value: 'MENSAJES', label: 'Mensajes de respuesta', description: 'Qué significa cada código con el que responde Impuestos.' },
  { value: 'EVENTOS', label: 'Eventos significativos', description: 'Motivos de contingencia (corte de internet, caída del SIN…).' },
  { value: 'MOTIVO_ANULACION', label: 'Motivos de anulación', description: 'Los motivos que se pueden alegar al anular una factura.' },
  { value: 'PAIS', label: 'Países', description: 'Países de origen reconocidos por Impuestos.' },
  { value: 'TIPO_DOC_IDENTIDAD', label: 'Tipos de documento de identidad', description: 'NIT, carnet, pasaporte y demás documentos del comprador.' },
  { value: 'TIPO_DOC_SECTOR', label: 'Tipos de documento sector', description: 'Clases de factura (compra-venta, servicios…).' },
  { value: 'TIPO_EMISION', label: 'Tipos de emisión', description: 'En línea, fuera de línea o masiva.' },
  { value: 'TIPO_HABITACION', label: 'Tipos de habitación', description: 'Sólo para el sector hotelero; se sincroniza por completitud.' },
  { value: 'METODO_PAGO', label: 'Métodos de pago', description: 'Efectivo, tarjeta, transferencia y demás medios reconocidos.' },
  { value: 'MONEDA', label: 'Monedas', description: 'Monedas reconocidas por Impuestos.' },
  { value: 'TIPO_PUNTO_VENTA', label: 'Tipos de punto de venta', description: 'Clases de punto de venta que se pueden registrar.' },
  { value: 'TIPOS_FACTURA', label: 'Tipos de factura', description: 'Con o sin derecho a crédito fiscal.' },
  { value: 'UNIDAD_MEDIDA', label: 'Unidades de medida', description: 'Unidades que se asignan a cada línea facturada.' },
];
