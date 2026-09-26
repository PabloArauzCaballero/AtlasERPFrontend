'use client';

import { useCallback, useMemo, useState } from 'react';
import { Modal } from '@/components/atlas/Modal';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { DataTable } from '@/components/ui/DataTable';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';
import { fiscalService } from '@/services/fiscalService';
import type { ResourceRow } from '@/services/types';
import { etiquetas, formatoFechaHora, toneEvento } from './comun';

type Paquete = Record<string, unknown>;

function paquetesDe(row: ResourceRow): Paquete[] {
  return Array.isArray(row.paquetes) ? (row.paquetes as Paquete[]) : [];
}

/** El paquete en palabras: cuántas facturas, cuándo viajó y qué contestó Impuestos. */
function filaPaquete(paquete: Paquete): ResourceRow {
  const codigo = paquete.codigoEstado;
  return {
    Facturas: String(paquete.cantidadFacturas ?? 0),
    Enviado: formatoFechaHora(paquete.sentAt),
    Validado: formatoFechaHora(paquete.validatedAt),
    'Respuesta de Impuestos': codigo === null || codigo === undefined ? 'Sin respuesta todavía' : String(codigo),
  };
}

/**
 * Contingencias: los ratos en que Impuestos no respondió y las facturas se emitieron fuera de
 * línea. Cada una se registra ante el SIN al volver la conexión y sus facturas viajan en paquetes.
 * El sistema lo hace solo; «Enviar pendientes» sólo lo adelanta.
 */
export function ContingenciasPanel({ activo }: Readonly<{ activo: boolean }>) {
  const load = useCallback(async () => {
    const eventos = await fiscalService.listEvents();
    return (eventos ?? []).map((evento) => ({ ...evento, cantidadPaquetes: paquetesDe(evento).length }));
  }, []);
  const estados = useOptions(domainLoader('domain:fiscal.eventStatus'));
  const etiquetasEstado = useMemo(() => etiquetas(estados), [estados]);
  const [viendo, setViendo] = useState<ResourceRow | null>(null);

  return (
    <>
      <CrudDirectory
        embedded
        moduleLabel="Contabilidad"
        title="Contingencias"
        description="Periodos en que Impuestos no respondió y las facturas se emitieron fuera de línea, con los paquetes en que se enviaron después."
        load={load}
        labelKey="descripcion"
        searchPlaceholder="Buscar por descripción o estado…"
        emptyHint="Sin contingencias: todas las facturas se enviaron en línea."
        columns={[
          { key: 'descripcion', label: 'Motivo' },
          { key: 'inicio', label: 'Desde', kind: 'date' },
          { key: 'fin', label: 'Hasta', kind: 'date' },
          { key: 'cantidadPaquetes', label: 'Paquetes', align: 'right' },
          { key: 'status', label: 'Estado', kind: 'status', labels: etiquetasEstado, tone: toneEvento },
        ]}
        filters={[{ key: 'status', label: 'Estado', options: [...estados] }]}
        extraActions={[
          {
            key: 'paquetes',
            label: 'Ver paquetes',
            icon: 'inventory_2',
            primary: true,
            silent: true,
            enabled: (row) => paquetesDe(row).length > 0,
            run: async (row) => { setViendo(row); },
          },
        ]}
        toolbarActions={
          activo
            ? [
                {
                  key: 'enviar',
                  label: 'Enviar pendientes',
                  icon: 'cloud_upload',
                  title: 'Enviar a Impuestos lo pendiente',
                  description: 'Registra las contingencias cerradas y envía sus paquetes ahora, sin esperar al próximo ciclo automático.',
                  submitLabel: 'Enviar ahora',
                  fields: [],
                  submit: () => fiscalService.dispatchEvents(),
                },
              ]
            : []
        }
        notice={{
          tone: 'info',
          title: 'Qué es una contingencia',
          body: 'Cuando Impuestos no responde, el ERP sigue facturando fuera de línea con el último código diario válido: la factura vale y el cliente la recibe. Al volver la conexión, el sistema registra el evento y envía esas facturas en paquetes.',
        }}
      />
      {viendo ? (
        <Modal open title={`Paquetes de «${String(viendo.descripcion ?? 'la contingencia')}»`} icon="inventory_2" onClose={() => setViendo(null)}>
          <DataTable columns={['Facturas', 'Enviado', 'Validado', 'Respuesta de Impuestos']} rows={paquetesDe(viendo).map(filaPaquete)} />
        </Modal>
      ) : null}
    </>
  );
}
