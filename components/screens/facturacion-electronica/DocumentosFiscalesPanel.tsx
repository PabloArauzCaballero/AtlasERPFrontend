'use client';

import { useCallback, useMemo } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';
import { fiscalService, loadMotivosAnulacion } from '@/services/fiscalService';
import type { JsonObject, ResourceRow } from '@/services/types';
import { etiquetas, toneSiat } from './comun';

const ANULABLES = new Set(['ACCEPTED', 'OBSERVED']);
/** Estados sin XML propio: el registro heredado nunca se transmitió. */
const SIN_ARCHIVO = new Set(['PENDING']);

const numero = (row: ResourceRow) => String(row.numeroFactura ?? '');

/**
 * Documentos fiscales: cada factura del ERP tal como la ve Impuestos Nacionales.
 *
 * La tabla es la pantalla. Lo que se hace con un documento se hace desde su fila: reintentar el
 * envío sólo aparece en «Error de envío» y anular sólo en una factura que Impuestos ya registró
 * (validada u observada); en cualquier otro estado esos botones mentirían.
 */
export function DocumentosFiscalesPanel({ activo }: Readonly<{ activo: boolean }>) {
  const load = useCallback(() => fiscalService.listAllDocuments(), []);
  const estados = useOptions(domainLoader('domain:accounting.siatStatus'));
  const origenes = useOptions(domainLoader('domain:fiscal.sourceType'));
  const etiquetasEstado = useMemo(() => etiquetas(estados), [estados]);
  const etiquetasOrigen = useMemo(() => etiquetas(origenes), [origenes]);

  async function anular(row: ResourceRow, payload: JsonObject) {
    return fiscalService.annulDocument(String(row.id ?? ''), Number(payload.codigoMotivo));
  }

  return (
    <CrudDirectory
      embedded
      moduleLabel="Contabilidad"
      title="Documentos fiscales"
      description="Cada factura enviada a Impuestos Nacionales, con su número fiscal y lo que respondió."
      load={load}
      labelKey="numeroFactura"
      searchPlaceholder="Buscar por número, cliente o NIT…"
      emptyHint="Los documentos fiscales nacen solos al emitir una factura con la facturación electrónica encendida."
      columns={[
        { key: 'numeroFactura', label: 'N° fiscal', kind: 'mono' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'nit', label: 'NIT', kind: 'mono' },
        { key: 'fechaEmision', label: 'Emisión', kind: 'date' },
        { key: 'montoTotal', label: 'Total', kind: 'money', align: 'right' },
        { key: 'siatStatus', label: 'Estado', kind: 'status', labels: etiquetasEstado, tone: toneSiat },
        { key: 'codigoEstadoSin', label: 'Código de Impuestos', kind: 'mono' },
        { key: 'sourceType', label: 'Origen', labels: etiquetasOrigen },
      ]}
      filters={[
        { key: 'siatStatus', label: 'Estado', options: [...estados] },
        { key: 'sourceType', label: 'Origen', options: [...origenes] },
      ]}
      extraActions={[
        {
          key: 'reintentar',
          label: 'Reintentar envío',
          description: 'Vuelve a enviar a Impuestos una factura que falló, con el mismo número y código de autorización.',
          icon: 'send',
          primary: true,
          enabled: (row) => row.siatStatus === 'ERROR',
          confirm: {
            title: 'Reintentar el envío a Impuestos',
            message: 'El documento vuelve a la cola y se envía en los próximos segundos, con el mismo número y el mismo código de autorización.',
            confirmLabel: 'Reintentar envío',
          },
          run: (row) => fiscalService.retryDocument(String(row.id ?? '')),
        },
        {
          key: 'anular',
          label: 'Anular ante Impuestos',
          description: 'Anula la factura ante Impuestos y revierte su asiento. Es definitivo y sólo vale hasta el día 9 del mes siguiente.',
          icon: 'block',
          tone: 'danger',
          primary: true,
          enabled: (row) => activo && ANULABLES.has(String(row.siatStatus ?? '')),
          form: {
            title: (row) => `Anular la factura ${numero(row)} ante Impuestos`,
            description:
              'La anulación es definitiva: Impuestos la registra, la factura del ERP queda anulada y su asiento se revierte. Sólo se admite hasta el día 9 del mes siguiente y si la factura no tiene cobros aplicados.',
            submitLabel: 'Anular factura',
            submit: anular,
            fields: [
              {
                name: 'codigoMotivo',
                label: 'Motivo de la anulación',
                tooltip: 'El motivo que se informa a Impuestos; sale de su propio catálogo. Ej.: datos de emisión incorrectos.',
                type: 'select',
                valueKind: 'number',
                required: true,
                optionsLoader: loadMotivosAnulacion,
              },
            ],
          },
        },
        {
          key: 'pdf',
          label: 'Descargar PDF',
          description: 'Descarga la representación impresa de la factura para entregarla al cliente.',
          icon: 'picture_as_pdf',
          primary: true,
          silent: true,
          enabled: (row) => !SIN_ARCHIVO.has(String(row.siatStatus ?? '')),
          run: (row) => fiscalService.downloadDocument(String(row.id ?? ''), 'pdf', numero(row)),
        },
        {
          key: 'xml',
          label: 'Descargar XML',
          description: 'Descarga el XML del documento fiscal tal como lo generó el ERP. Sólo tiene validez legal si el modo de arriba dice que hay envío real a Impuestos.',
          icon: 'code',
          primary: true,
          silent: true,
          enabled: (row) => !SIN_ARCHIVO.has(String(row.siatStatus ?? '')),
          run: (row) => fiscalService.downloadDocument(String(row.id ?? ''), 'xml', numero(row)),
        },
      ]}
      notice={{
        tone: 'info',
        title: 'Qué es un documento fiscal',
        body: 'Es la factura tal como la registró el servicio fiscal de este entorno: número fiscal, código de autorización (CUF) y su respuesta. Se crea sola al emitir la factura en el ERP; un documento no se edita: se anula y se emite otro. Mientras no haya envío real a Impuestos (ver el aviso de arriba), esos datos son de prueba.',
      }}
    />
  );
}
