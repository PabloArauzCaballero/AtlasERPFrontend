'use client';

import { useCallback } from 'react';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CatalogosSinPanel } from '@/components/screens/facturacion-electronica/CatalogosSinPanel';
import { ContingenciasPanel } from '@/components/screens/facturacion-electronica/ContingenciasPanel';
import { DocumentosFiscalesPanel } from '@/components/screens/facturacion-electronica/DocumentosFiscalesPanel';
import { EmisoresPanel } from '@/components/screens/facturacion-electronica/EmisoresPanel';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { fiscalService } from '@/services/fiscalService';
import { StatusPill } from '@/components/atlas/StatusPill';
import { describirModoFiscal } from '@/lib/modoFiscal';

/**
 * Facturación electrónica: las facturas del ERP ante Impuestos Nacionales.
 *
 * Cuatro secciones del mismo dominio, cada una un sustantivo: los documentos (lo que se consulta a
 * diario), el emisor, los catálogos del SIN y las contingencias. Las acciones viven en la fila o
 * en «Más» de cada tabla, nunca en la barra de pestañas.
 *
 * Con la facturación electrónica apagada en el entorno la pantalla lo DICE arriba y esconde lo que
 * habla con Impuestos: un botón que siempre contesta «no disponible» se lee como una avería.
 */
export default function FacturacionElectronicaPage() {
  const cargar = useCallback(() => fiscalService.status(), []);
  const estado = useAsyncResource(cargar);
  const activo = estado.data?.activo === true;
  const listo = Boolean(estado.data) || Boolean(estado.error);
  const modo = estado.data ? describirModoFiscal(estado.data) : null;

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Facturación electrónica' }]}
        title="Facturación electrónica"
        description="El documento fiscal de cada factura del ERP y lo que respondió el servicio fiscal de este entorno: su validación, el emisor, los catálogos del SIN y las contingencias."
      />
      {estado.error ? (
        <InlineNotice tone="danger" title="No se pudo saber si la facturación electrónica está encendida">{estado.error}</InlineNotice>
      ) : null}
      {modo ? (
        <InlineNotice
          tone={modo.real ? 'info' : 'warning'}
          title={modo.apagada ? 'La facturación electrónica está apagada en este entorno' : modo.real ? `Modo: ${modo.etiqueta}` : `Modo: ${modo.etiqueta} · sin envío real a Impuestos`}
        >
          <span data-testid="modo-fiscal">{modo.aviso}</span>{' '}
          <StatusPill tone={modo.real ? 'success' : 'warning'}>{modo.etiqueta}</StatusPill>
        </InlineNotice>
      ) : null}
      {listo ? (
        <TabbedPanels
          tabs={[
            { id: 'documentos', label: 'Documentos fiscales', icon: 'receipt_long', content: <DocumentosFiscalesPanel activo={activo} /> },
            { id: 'emisor', label: 'Emisor y credenciales', icon: 'badge', content: <EmisoresPanel activo={activo} /> },
            { id: 'catalogos', label: 'Catálogos del SIN', icon: 'menu_book', content: <CatalogosSinPanel activo={activo} /> },
            { id: 'contingencias', label: 'Contingencias', icon: 'cloud_off', content: <ContingenciasPanel activo={activo} /> },
          ]}
        />
      ) : (
        <PageSkeleton />
      )}
    </div>
  );
}
