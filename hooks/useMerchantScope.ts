'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalService } from '@/services/portalService';

export interface MerchantScope {
  /** `true` cuando quien mira es el comercio y no personal interno. Lo dice el backend. */
  isMerchant: boolean;
  /**
   * Cuenta sobre la que operar, o `undefined` cuando la deriva el backend.
   *
   * Un comercio con una sola cuenta no manda nada: su alcance sale de sus membresías
   * (`PortalScopeService`), y mandar un identificador desde el navegador no le daría acceso a nada
   * que no tuviera ya — sólo abriría la puerta a probar suerte con UUIDs ajenos.
   */
  accountId: string | undefined;
  /** Quien tiene que elegir, elige; a quien no, no se le enseña selector. */
  setAccountId: (value: string) => void;
  accountOptions: { value: string; label: string }[];
  /** `true` cuando hay que pintar el selector: lo decide el servidor, no la pantalla. */
  requiresSelection: boolean;
  /** `false` mientras falte por resolver el alcance o por elegir cuenta: no hay nada que pedir. */
  ready: boolean;
  /** Por qué no se puede operar todavía, cuando el alcance ni siquiera se pudo leer. */
  error: string | null;
}

/**
 * Resuelve sobre qué comercio trabaja una pantalla del portal.
 *
 * ## Por qué lo contesta el servidor y no el navegador
 *
 * Antes esto se decidía con `sessionKind`, un valor que el propio navegador se guardaba al entrar.
 * El backend, en cambio, decide por los roles del token (`PORTAL_INTERNAL_ROLES`). Mientras los dos
 * coincidían no se notaba; cuando no, la pantalla se quedaba **sin salida**: se creía comercio, así
 * que no pintaba el selector ni mandaba cuenta, y el backend —que la veía como staff interno— le
 * exigía justamente la cuenta que la pantalla había decidido no ofrecer. El resultado era un
 * «No se pudo cargar» del que no se salía haciendo nada en la pantalla.
 *
 * Y no es un caso raro: con `AUTH_DISABLED_FOR_LOCAL_TESTING=true` —como está el ERP en local—
 * TODA petición llega al backend como ADMIN, sea cual sea la sesión del navegador. O sea que en
 * desarrollo el desacuerdo era permanente, y afectaba a las cuatro pantallas que usan este hook.
 *
 * Ahora hay una sola fuente de verdad: `GET /portal/scope`. La pantalla no deduce nada.
 *
 * ## Qué pasa si esa llamada falla
 *
 * Se dice, y no se adivina. Un fallo aquí deja `ready` en `false` con un `error` que la pantalla
 * puede mostrar; lo que no hace es asumir un alcance y disparar peticiones que van a fallar más
 * abajo con un mensaje que no señala la causa.
 */
export function useMerchantScope(): MerchantScope {
  const [scope, setScope] = useState<{
    isInternalOperator: boolean;
    requiresAccountSelection: boolean;
    accounts: { id: string; name: string }[];
  } | null>(null);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    portalService
      .getScope()
      .then((result) => {
        if (cancelled) return;
        setScope(result);
        /*
         * Con una sola cuenta que elegir, se elige sola.
         *
         * Es el caso del staff que entra a un comercio concreto y el del comercio con una única
         * cuenta: obligar a abrir un desplegable de un solo elemento es pedirle a la persona que
         * confirme lo único posible.
         */
        if (result.requiresAccountSelection && result.accounts.length === 1) {
          setAccountId(result.accounts[0]!.id);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo determinar sobre qué comercio puedes operar.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const elegir = useCallback((value: string) => setAccountId(value), []);

  const requiresSelection = scope?.requiresAccountSelection ?? false;

  return {
    isMerchant: scope ? !scope.isInternalOperator : false,
    // Sólo viaja cuando hay que elegir: si el backend deriva la cuenta, mandarla sería ruido.
    accountId: requiresSelection ? accountId || undefined : undefined,
    setAccountId: elegir,
    accountOptions: (scope?.accounts ?? []).map((account) => ({
      value: account.id,
      label: account.name,
    })),
    requiresSelection,
    ready: scope !== null && (!requiresSelection || Boolean(accountId)),
    error,
  };
}
