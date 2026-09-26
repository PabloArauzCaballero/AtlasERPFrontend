'use client';

import { useCallback } from 'react';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { StatusPill } from '@/components/atlas/StatusPill';
import { InlineLoading } from '@/components/ui/LoadingIndicator';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { fiscalService, type EstadoEmisor } from '@/services/fiscalService';
import { formatoFechaHora } from './comun';

function vigencia(hasta: string | null): { texto: string; tone: 'success' | 'danger' | 'neutral' } {
  if (!hasta) return { texto: 'Sin pedir todavía', tone: 'neutral' };
  const vigente = new Date(hasta).getTime() > Date.now();
  return { texto: `${vigente ? 'Vigente' : 'Vencido'} · hasta ${formatoFechaHora(hasta)}`, tone: vigente ? 'success' : 'danger' };
}

function Fila({ etiqueta, children }: Readonly<{ etiqueta: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-xs font-semibold text-slate-500">{etiqueta}</dt>
      <dd className="text-sm text-slate-900 sm:text-right">{children}</dd>
    </div>
  );
}

function Contenido({ estado }: Readonly<{ estado: EstadoEmisor }>) {
  const cuis = vigencia(estado.cuisVigenteHasta);
  const cufd = vigencia(estado.cufdVigenteHasta);
  const sync = estado.ultimaSincronizacion;
  const comunicacion =
    estado.comunicacionOk === null
      ? { texto: 'No se comprueba: la facturación electrónica está apagada', tone: 'neutral' as const }
      : estado.comunicacionOk
        ? { texto: 'Impuestos responde', tone: 'success' as const }
        : { texto: 'Impuestos no responde', tone: 'danger' as const };

  return (
    <div className="space-y-4">
      {estado.contingenciaAbierta ? (
        <InlineNotice tone="warning" title="Contingencia abierta">
          Desde {formatoFechaHora(estado.contingenciaAbierta.desde)} las facturas se emiten fuera de línea; se enviarán en paquete cuando vuelva la conexión.
        </InlineNotice>
      ) : null}
      <dl data-testid="estado-emisor">
        <Fila etiqueta="Comunicación con Impuestos">
          <StatusPill tone={comunicacion.tone}>{comunicacion.texto}</StatusPill>
        </Fila>
        <Fila etiqueta="Ambiente">
          {estado.codigoAmbiente === 1 ? 'Producción' : estado.codigoAmbiente === 2 ? 'Pruebas (sin validez fiscal)' : '—'}
        </Fila>
        <Fila etiqueta="Código de sistema (CUIS)">
          <StatusPill tone={cuis.tone} dot={false}>{cuis.texto}</StatusPill>
        </Fila>
        <Fila etiqueta="Código diario (CUFD)">
          <StatusPill tone={cufd.tone} dot={false}>{cufd.texto}</StatusPill>
        </Fila>
        <Fila etiqueta="Última sincronización de catálogos">
          {sync
            ? `${formatoFechaHora(sync.en)} · ${sync.ok === false ? 'falló' : `${Object.keys(sync.catalogos ?? {}).length} catálogos`}`
            : 'Nunca'}
        </Fila>
      </dl>
      {sync?.ok === false && sync.error ? (
        <InlineNotice tone="danger" title="La última sincronización falló">{sync.error}</InlineNotice>
      ) : null}
    </div>
  );
}

/** Cómo está un emisor ante Impuestos: conexión, vigencia de sus códigos y catálogos. */
export function EstadoEmisorModal({ perfilId, nombre, onClose }: Readonly<{ perfilId: string; nombre: string; onClose: () => void }>) {
  const cargar = useCallback(() => fiscalService.issuerStatus(perfilId), [perfilId]);
  const recurso = useAsyncResource(cargar);

  return (
    <Modal open title={`Estado de ${nombre}`} icon="monitor_heart" width="md" onClose={onClose}>
      {recurso.data ? (
        <Contenido estado={recurso.data} />
      ) : recurso.error ? (
        <InlineNotice tone="danger" title="No se pudo leer el estado">{recurso.error}</InlineNotice>
      ) : (
        <InlineLoading text="Consultando a Impuestos…" />
      )}
    </Modal>
  );
}
