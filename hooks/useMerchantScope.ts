'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useOptions } from '@/hooks/useOptions';
import { b2bService } from '@/services/b2bService';
import type { ResourceRow } from '@/services/types';

export interface MerchantScope {
  /** `true` cuando quien mira es el comercio y no personal interno. */
  isMerchant: boolean;
  /**
   * Cuenta sobre la que operar, o `undefined` cuando la deriva el backend.
   *
   * Para un comercio es SIEMPRE `undefined`: su alcance sale de sus membresías
   * (`PortalScopeService`), y mandar un identificador desde el navegador no le daría acceso a nada
   * que no tuviera ya — sólo abriría la puerta a probar suerte con UUIDs ajenos.
   */
  accountId: string | undefined;
  /** El staff interno sí elige; el comercio no ve selector. */
  setAccountId: (value: string) => void;
  accountOptions: { value: string; label: string }[];
  /** `false` mientras el staff no haya elegido: no hay nada que pedir todavía. */
  ready: boolean;
}

/**
 * Resuelve sobre qué comercio trabaja una pantalla del portal.
 *
 * Existe porque las dos poblaciones que comparten estas pantallas necesitan cosas opuestas: el
 * staff interno tiene que decir a qué comercio entra (y queda auditado como acceso delegado),
 * mientras que el comercio no debe elegir nada. Antes las pantallas asumían siempre lo primero, con
 * un selector alimentado por `b2b/accounts` —un endpoint interno que un comercio ni siquiera puede
 * llamar—, así que el portal sólo era usable por personal de Atlas.
 */
export function useMerchantScope(): MerchantScope {
  const { isMerchant } = useAuth();
  const [accountId, setAccountId] = useState('');

  const accountOptions = useOptions(
    useCallback(async () => {
      // El comercio no lista comercios: ni lo necesita ni el backend se lo permitiría.
      if (isMerchant) return [];
      const result = await b2bService.listAccounts({ page: 1, limit: 100 });
      const rows = (result.items ?? result.rows ?? []) as ResourceRow[];
      return rows.map((row) => ({ value: String(row.id), label: String(row.tradeName ?? row.legalName ?? 'Comercio') }));
    }, [isMerchant]),
  );

  return {
    isMerchant,
    accountId: isMerchant ? undefined : accountId || undefined,
    setAccountId,
    accountOptions,
    ready: isMerchant || Boolean(accountId),
  };
}
