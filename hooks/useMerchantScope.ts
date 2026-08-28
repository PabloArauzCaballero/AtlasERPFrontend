'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalService } from '@/services/portalService';

export interface MerchantScope {
  /** `true` cuando quien mira es el comercio y no personal interno. Lo dice el backend. */
  isMerchant: boolean;
  /**
   * Cuenta sobre la que operar, o `undefined` cuando la deriva el backend.
   *
   * Lo normal es `undefined`: el comercio que entró es el comercio sobre el que se opera, y su
   * alcance sale de sus membresías (`PortalScopeService`). Mandar un identificador desde el
   * navegador no le daría acceso a nada que no tuviera ya — sólo abriría la puerta a probar
   * suerte con UUIDs ajenos.
   */
  accountId: string | undefined;
  /** Sólo para el usuario que administra VARIOS comercios: con cuál de los suyos sigue. */
  setAccountId: (value: string) => void;
  /** Los comercios DEL PROPIO usuario. Nunca el catálogo de la plataforma. */
  accountOptions: { value: string; label: string }[];
  /** `true` únicamente cuando el usuario pertenece a más de un comercio. */
  requiresSelection: boolean;
  /** `false` mientras falte por resolver el alcance o por elegir cuenta: no hay nada que pedir. */
  ready: boolean;
  /** Por qué no se puede operar todavía, cuando el alcance ni siquiera se pudo leer. */
  error: string | null;
}

/**
 * Resuelve sobre qué comercio trabaja una pantalla del portal.
 *
 * ## El comercio no elige comercio
 *
 * Estas pantallas viven bajo `/portal-comercio`, que `RequireAuth audience="merchant"` reserva a
 * la sesión del comercio: el negocio sobre el que se opera es, por construcción, el que está
 * logueado. Por eso aquí no hay selector de comercio y el `accountId` normalmente no viaja.
 *
 * La única excepción es el usuario que administra MÁS DE UN comercio —tiene varias membresías en
 * `atlas_sales.merchant_users`—: ahí sí hay algo que elegir, y lo que se elige son sus propias
 * cuentas, nunca el catálogo de la plataforma.
 *
 * ## Por qué lo contesta el servidor y no el navegador
 *
 * Antes esto se decidía con `sessionKind`, un valor que el propio navegador se guardaba al entrar.
 * El backend decide por los roles del token (`PORTAL_INTERNAL_ROLES`), así que cuando los dos no
 * coincidían la pantalla se quedaba sin salida. Hoy hay una sola fuente de verdad:
 * `GET /portal/scope`.
 *
 * ## Staff interno aquí es una avería, no un modo
 *
 * Si el alcance dice «operador interno» estando en el portal del comercio, algo está mal: el
 * staff opera desde `/operaciones`, y `RequireAuth` ni siquiera le deja entrar aquí. Se dice, en
 * vez de pintarle un desplegable con todos los comercios de la plataforma —que es lo que pasaba
 * en local, donde `AUTH_DISABLED_FOR_LOCAL_TESTING` convertía en ADMIN a todo el que entraba—.
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

  const isMerchant = scope ? !scope.isInternalOperator : false;
  /*
   * Elegir es cosa de tener VARIAS cuentas propias, no de `requiresAccountSelection`.
   *
   * Ese campo del backend también se pone a `true` para el staff interno, que no pinta nada en
   * este portal; usarlo tal cual es lo que hacía aparecer el desplegable de comercios.
   */
  const requiresSelection = isMerchant && (scope?.accounts.length ?? 0) > 1;

  return {
    isMerchant,
    // Sólo viaja cuando hay varias cuentas propias: si el backend deriva la cuenta, mandarla sería ruido.
    accountId: requiresSelection ? accountId || undefined : undefined,
    setAccountId: elegir,
    accountOptions: (scope?.accounts ?? []).map((account) => ({
      value: account.id,
      label: account.name,
    })),
    requiresSelection,
    ready: scope !== null && isMerchant && (!requiresSelection || Boolean(accountId)),
    error:
      error ??
      (scope?.isInternalOperator
        ? 'Esta sección es del portal del comercio y opera sobre el negocio que inició sesión. Tu usuario es personal interno de Atlas: entra desde Operaciones para atender a un comercio.'
        : null),
  };
}
