'use client';

import { useCallback, useState } from 'react';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useMerchantPartner } from '@/hooks/useMerchantPartner';
import { useTabParam } from '@/hooks/useTabParam';
import { MerchantPartnerPicker } from './MerchantPartnerPicker';
import { MerchantPaymentProofsScreen } from './MerchantPaymentProofsScreen';
import { MerchantRequestsScreen } from './MerchantRequestsScreen';

const PESTANAS = ['solicitudes', 'comprobantes'] as const;

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

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Gestión POS' }]}
        title="Gestión POS"
        description="Lo que pasa en su caja: las compras que sus clientes piden con el QR y los pagos que avisan haber transferido. Usted acepta, rechaza y confirma."
      />

      <MerchantPartnerPicker partner={partner} />
      {partner.error ? <InlineNotice tone="danger">{partner.error}</InlineNotice> : null}

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
              />
            ),
          },
        ]}
      />
    </div>
  );
}
