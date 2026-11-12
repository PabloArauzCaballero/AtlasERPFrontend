'use client';

import { useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useMerchantPartner } from '@/hooks/useMerchantPartner';
import { useTabParam } from '@/hooks/useTabParam';
import { useAvisoDeLlegada } from '@/hooks/useAvisoDeLlegada';
import { formatBob } from '@/lib/formatters';
import type { ComprobanteDePago, PagoInicial, SolicitudDeCompra } from '@/services/merchantCreditService';
import { MerchantPartnerPicker } from './MerchantPartnerPicker';
import { MerchantPaymentProofsScreen } from './MerchantPaymentProofsScreen';
import { MerchantPosHistoryScreen } from './MerchantPosHistoryScreen';
import { MerchantRequestsScreen } from './MerchantRequestsScreen';

const PESTANAS = ['solicitudes', 'comprobantes', 'historial'] as const;

/**
 * Gestión POS: lo que pasa en la caja, en una sola pantalla.
 *
 * Eran dos entradas de menú —«Solicitudes de compra» y «Comprobantes por verificar»— y son los
 * dos momentos de la MISMA operación: el cliente escanea y pide, el comercio acepta; el cliente
 * transfiere y avisa, el comercio confirma. Separarlas obligaba a quien está en el mostrador a
 * saber de antemano en cuál de las dos está lo que tiene delante, y a cambiar de pantalla —con
 * su carga y su nueva resolución de expediente— entre un paso y el siguiente del mismo cliente.
 *
 * Los contadores de cada pestaña existen por eso mismo: desde cualquiera de las dos se ve si en
 * la otra hay algo esperando, que es lo que antes obligaba a ir a mirar.
 *
 * El expediente se resuelve AQUÍ y una sola vez (`useMerchantPartner`). Antes cada pantalla lo
 * resolvía por su cuenta y con criterios distintos —una tomaba el aprobado, la otra el primero
 * que llegara—, así que dos pestañas contiguas podían estar hablando de comercios distintos.
 */
export function MerchantPosScreen() {
  const partner = useMerchantPartner();
  const [pestana, elegirPestana] = useTabParam('solicitudes', PESTANAS);
  const [pendientes, setPendientes] = useState<{ solicitudes: number | null; comprobantes: number | null }>({
    solicitudes: null,
    comprobantes: null,
  });

  /*
   * Los contadores se guardan por separado y con `setState` funcional: las dos pestañas están
   * montadas a la vez (`keepMounted`) y sus cargas terminan cuando terminan, así que la segunda
   * en llegar no puede escribir sobre el resultado de la primera.
   */
  const contarSolicitudes = useCallback((total: number) => {
    setPendientes((previo) => (previo.solicitudes === total ? previo : { ...previo, solicitudes: total }));
  }, []);
  const contarComprobantes = useCallback((total: number) => {
    setPendientes((previo) => (previo.comprobantes === total ? previo : { ...previo, comprobantes: total }));
  }, []);

  /*
   * Lo que llega mientras alguien espera en la caja: aviso en la página, número en el título de la
   * pestaña y un tono corto (que se puede apagar). Las colas se releen solas cada pocos segundos.
   */
  const { llegadas, avisar, descartar, sonido, alternarSonido } = useAvisoDeLlegada(
    'Gestión POS',
    (pendientes.solicitudes ?? 0) + (pendientes.comprobantes ?? 0),
  );
  const nuevasSolicitudes = useCallback(
    (nuevas: SolicitudDeCompra[]) =>
      avisar(nuevas.map((s) => ({ id: `s-${s.applicationId}`, texto: `Nueva solicitud: ${importe(s.grossAmount ?? s.requestedAmount)}` }))),
    [avisar],
  );
  const nuevosComprobantes = useCallback(
    (nuevos: ComprobanteDePago[]) =>
      avisar(nuevos.map((c) => ({ id: `c-${c.claimId}`, texto: `Nuevo comprobante de cuota: ${importe(c.claimedAmount)}` }))),
    [avisar],
  );
  const nuevosIniciales = useCallback(
    (nuevos: PagoInicial[]) =>
      avisar(nuevos.map((p) => ({ id: `i-${p.applicationId}`, texto: `Nuevo pago inicial: ${importe(p.downPaymentAmount)}` }))),
    [avisar],
  );

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Gestión POS' }]}
        title="Gestión POS"
        description="Lo que pasa en tu caja: las compras que tus clientes piden con el QR y los pagos que avisan haber transferido. Tú aceptas, rechazas y confirmas."
      />

      <MerchantPartnerPicker partner={partner} />
      {partner.error ? <InlineNotice tone="danger">{partner.error}</InlineNotice> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div role="status" aria-live="polite" className="min-w-0 flex-1" data-testid="llegadas-pos">
          {llegadas.length ? (
            <InlineNotice tone="info" title={llegadas.length === 1 ? 'Llegó algo nuevo' : `Llegaron ${llegadas.length} novedades`}>
              <ul>
                {llegadas.map((llegada) => (
                  <li key={llegada.id}>{llegada.texto}</li>
                ))}
              </ul>
              <button type="button" className="mt-1 font-semibold underline" onClick={descartar}>Entendido</button>
            </InlineNotice>
          ) : (
            <p className="text-xs text-slate-500">Las listas se actualizan solas cada pocos segundos mientras esta pestaña está abierta.</p>
          )}
        </div>
        <AtlasButton
          variant="secondary"
          icon={sonido ? 'volume_up' : 'volume_off'}
          aria-pressed={sonido}
          onClick={alternarSonido}
          data-testid="alternar-sonido"
        >
          {sonido ? 'Sonido activado' : 'Sonido apagado'}
        </AtlasButton>
      </div>

      <TabbedPanels
        keepMounted
        activeId={pestana}
        onChange={elegirPestana}
        tabs={[
          {
            id: 'solicitudes',
            label: 'Solicitudes de compra',
            icon: 'inbox',
            ...(pendientes.solicitudes === null ? {} : { badge: pendientes.solicitudes }),
            content: (
              <MerchantRequestsScreen
                embedded
                partnerId={partner.partnerId}
                nombre={partner.nombre}
                onCount={contarSolicitudes}
                onNuevas={nuevasSolicitudes}
              />
            ),
          },
          {
            id: 'comprobantes',
            label: 'Comprobantes por verificar',
            icon: 'receipt_long',
            ...(pendientes.comprobantes === null ? {} : { badge: pendientes.comprobantes }),
            content: (
              <MerchantPaymentProofsScreen
                embedded
                partnerId={partner.partnerId}
                nombre={partner.nombre}
                onCount={contarComprobantes}
                onNuevos={nuevosComprobantes}
                onNuevosIniciales={nuevosIniciales}
              />
            ),
          },
          {
            // Lo ya respondido y todos los pagos, iniciales y de cuota (Pablo, 2026-10-08).
            id: 'historial',
            label: 'Historial',
            icon: 'history',
            content: <MerchantPosHistoryScreen partnerId={partner.partnerId} />,
          },
        ]}
      />
    </div>
  );
}

function importe(valor: string | number | null | undefined): string {
  const numero = Number(valor);
  return Number.isFinite(numero) && valor !== null && valor !== '' ? formatBob(numero) : 'importe por confirmar';
}
