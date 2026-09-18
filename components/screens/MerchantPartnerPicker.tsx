'use client';

import { InlineNotice } from '@/components/atlas/InlineNotice';
import { OptionSelect } from '@/components/atlas/OptionSelect';
import type { MerchantPartner } from '@/hooks/useMerchantPartner';

/**
 * Con qué expediente se está trabajando, cuando el usuario tiene más de uno.
 *
 * No se pinta nunca con uno solo: un desplegable de un elemento es una pregunta sin respuestas.
 * Con varios sí se pinta y se dice en voz alta, porque antes se tomaba el primero en silencio y
 * el QR —o la decisión sobre una compra— podía acabar en el comercio equivocado sin que nada en
 * la pantalla lo delatara.
 */
export function MerchantPartnerPicker({ partner }: Readonly<{ partner: MerchantPartner }>) {
  if (partner.expedientes.length <= 1) return null;

  return (
    <InlineNotice tone="info" title="Su usuario tiene varios expedientes">
      <label className="flex flex-wrap items-center gap-2 text-xs">
        <span>Todo lo de esta pantalla es del expediente elegido:</span>
        <OptionSelect
          name="expediente-activo"
          ariaLabel="Expediente sobre el que se opera"
          compact
          className="min-w-64"
          value={partner.partnerId}
          onChange={partner.elegir}
          options={partner.expedientes.map((perfil) => ({
            value: perfil.partnerId,
            label: perfil.tradeName ?? perfil.legalName ?? `Expediente ${perfil.partnerId}`,
            description: `Expediente ${perfil.partnerId} · estado ${perfil.status}`,
          }))}
        />
      </label>
    </InlineNotice>
  );
}
