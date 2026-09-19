'use client';

import { useCallback, useEffect, useState } from 'react';
import { merchantCreditService } from '@/services/merchantCreditService';
import { SIN_EXPEDIENTE } from '@/lib/avisosDelComercio';

export interface ExpedienteDelComercio {
  partnerId: string;
  legalName: string | null;
  tradeName: string | null;
  status: string;
}

export interface MerchantPartner {
  /** El expediente sobre el que trabaja la vista. Vacío mientras se resuelve o si no hay ninguno. */
  partnerId: string;
  /** Nombre con el que enseñarlo: el comercial si lo hay, el legal si no. */
  nombre: string;
  /** Estado del expediente (`draft`, `approved`…): decide qué se puede tocar. */
  estado: string;
  /** Todos los del usuario. Con más de uno hay algo que elegir y se elige explícito. */
  expedientes: ExpedienteDelComercio[];
  elegir: (partnerId: string) => void;
  cargando: boolean;
  error: string | null;
}

/**
 * Cuál es MI expediente, resuelto una sola vez para toda la vista.
 *
 * Hasta el 2026-09-18 esto lo hacía cada pantalla por su cuenta y con criterios distintos: «Mi QR
 * de cobro» tomaba el APROBADO —es el que cobra—, y Solicitudes y Comprobantes tomaban el primero
 * que llegara. Mientras fueron páginas separadas era una incoherencia tolerable; en cuanto pasan a
 * ser pestañas de una misma pantalla deja de serlo, porque dos pestañas contiguas podían estar
 * hablando de comercios distintos sin decirlo en ninguna parte.
 *
 * Aquí manda una sola regla, la de «Mi QR»: **el aprobado primero**. Es el expediente con el que
 * el comercio opera de verdad; el resto son trámites a medias. Y si hay varios, el que se eligió
 * vale para todas las pestañas a la vez, que es el único comportamiento que no engaña.
 */
export function useMerchantPartner(): MerchantPartner {
  const [expedientes, setExpedientes] = useState<ExpedienteDelComercio[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    merchantCreditService
      .misExpedientes()
      .then((resultado) => {
        if (cancelado) return;
        const perfiles = resultado.profiles ?? [];
        const propio = perfiles.find((perfil) => perfil.status === 'approved') ?? perfiles[0];
        if (!propio) {
          setError(SIN_EXPEDIENTE);
          setCargando(false);
          return;
        }
        setExpedientes(perfiles);
        setPartnerId(propio.partnerId);
        setCargando(false);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setError(fallo instanceof Error ? fallo.message : 'No fue posible identificar su comercio.');
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const elegir = useCallback((id: string) => setPartnerId(id), []);

  const elegido = expedientes.find((perfil) => perfil.partnerId === partnerId);

  return {
    partnerId,
    nombre: elegido?.tradeName ?? elegido?.legalName ?? '',
    estado: elegido?.status ?? '',
    expedientes,
    elegir,
    cargando,
    error,
  };
}
