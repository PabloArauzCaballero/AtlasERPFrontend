'use client';

import { useCallback, useMemo } from 'react';
import { codigoDeExpediente } from '@/lib/codigoDeSucursal';
import { domainLoader } from '@/services/domains';
import { partnerOnboardingService } from '@/services/partnerOnboardingService';
import { portalService } from '@/services/portalService';
import type { JsonObject, ResourceRow } from '@/services/types';
import { ExcelImportModal, type LineasSpec } from './ExcelImportModal';
import type { ActionField } from './StructuredActionForm';

/** Los datos de la sucursal: lo básico. Las cajas van en las líneas de la hoja. */
const CAMPOS: ActionField[] = [
  {
    name: 'city',
    label: 'Ciudad',
    type: 'select',
    optional: true,
    optionsLoader: domainLoader('catalog:city'),
    tooltip: 'Ciudad del local. Se elige de la lista de «Valores permitidos»: escrita a mano, «Sta. Cruz» y «Santa Cruz» serían dos plazas.',
  },
  { name: 'address', label: 'Dirección', optional: true, tooltip: 'Dirección del local: calle, zona y referencia.', placeholder: 'Av. Principal #100, Equipetrol' },
];

/**
 * Una sucursal tiene CAJAS, y la caja es lo que tiene QR (así está modelado en el backend:
 * sucursal → cajas → QR por caja). Por eso la hoja lleva una fila por CAJA y las filas que repiten
 * la sucursal son la misma sucursal: tres cajas en Equipetrol son tres filas con «Equipetrol».
 */
const LINEAS: LineasSpec = {
  name: 'cajas',
  clave: 'sucursal',
  claveLabel: 'Sucursal',
  claveEnPayload: 'name',
  nombreLinea: 'caja',
  ejemploClave: 'Sucursal Equipetrol',
  fields: [
    {
      name: 'terminalAlias',
      label: 'Caja',
      optional: true,
      tooltip: 'Nombre corto para reconocer la caja en la lista. Ej.: Caja 1.',
      placeholder: 'Caja 1',
    },
    {
      name: 'terminalSerial',
      label: 'Serial de la caja',
      required: true,
      tooltip: 'Número de serie impreso en la caja o terminal. Es único: de él nace el QR de esa caja. Ej.: SN-00042.',
      placeholder: 'SN-00042',
    },
  ],
};

const plano = (texto: unknown) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

interface Props {
  open: boolean;
  /** Negocio al que pertenecen las sucursales (`useMerchantScope`). */
  accountId: string | undefined;
  /** Expediente del comercio: de él cuelgan las cajas y sus QR. Vacío = todavía no hay. */
  partnerId: string;
  onClose: () => void;
  onImported: () => void;
}

/**
 * Carga masiva de sucursales con sus cajas, desde Excel.
 *
 * Cada sucursal recorre el MISMO camino que un alta a mano —sucursal en el ERP, declarada en el
 * expediente, cada caja registrada en ella—, así que en cuanto entra tiene sus cajas y el QR de
 * cada una a la vista en «Sucursales», sin un paso más.
 *
 * **Reintentar no duplica.** Si una fila falla a medias (la sucursal se creó y una caja chocó con un
 * serial repetido), se corrige el Excel y se vuelve a subir entero: lo que ya existe se reutiliza
 * —la sucursal por su nombre, la caja por su serial— y sólo se crea lo que falta.
 */
export function ImportarSucursalesModal({ open, accountId, partnerId, onClose, onImported }: Props) {
  const submit = useCallback(
    async (payload: JsonObject) => {
      if (!partnerId) {
        // Antes de crear NADA: sin expediente la sucursal quedaría en el ERP sin poder tener caja ni QR.
        throw new Error('Abre primero el expediente de tu empresa (pestaña «Estado del expediente»): de él cuelgan las cajas y sus QR.');
      }
      const nombre = String(payload.name ?? '').trim();
      const cajas = ((payload.cajas as JsonObject[] | undefined) ?? []).filter((caja) => String(caja.terminalSerial ?? '').trim());

      // Se relee en cada sucursal: las anteriores del mismo archivo ya cambiaron el estado.
      const existentes = (await portalService.listBranches(accountId)) as ResourceRow[];
      let sucursal = existentes.find((fila) => plano(fila.name) === plano(nombre));
      if (!sucursal) {
        sucursal = await portalService.createBranch({
          name: nombre,
          ...(payload.city ? { city: String(payload.city) } : {}),
          ...(payload.address ? { address: String(payload.address) } : {}),
        });
      }
      const erpBranchId = String(sucursal.id);

      let estado = await partnerOnboardingService.getState(partnerId);
      let local = estado.branches.find((fila) => fila.erpBranchId === erpBranchId);
      if (!local) {
        local = await partnerOnboardingService.registerBranch(partnerId, {
          erpBranchId,
          branchCode: codigoDeExpediente(erpBranchId),
          name: nombre,
          ...(payload.city ? { city: String(payload.city) } : {}),
          ...(payload.address ? { addressLine: String(payload.address) } : {}),
        });
      }

      const yaRegistradas = new Set(estado.posTerminals.map((pos) => plano(pos.terminalSerial)));
      for (const caja of cajas) {
        const serial = String(caja.terminalSerial).trim();
        if (yaRegistradas.has(plano(serial))) continue;
        const alias = String(caja.terminalAlias ?? '').trim();
        try {
          await partnerOnboardingService.registerPosTerminal(partnerId, local.branchId, {
            terminalSerial: serial,
            ...(alias ? { terminalAlias: alias } : {}),
          });
        } catch (error) {
          throw new Error(
            `«${nombre}» quedó registrada, pero la caja ${serial} no: ${error instanceof Error ? error.message : 'error desconocido'}. ` +
              'Corrige el serial y vuelve a subir el archivo: lo que ya existe no se repite.',
          );
        }
        yaRegistradas.add(plano(serial));
      }
      estado = await partnerOnboardingService.getState(partnerId);
      return estado;
    },
    [accountId, partnerId],
  );

  const descripcion = useMemo(
    () =>
      'Una fila por CAJA: las filas que repiten el nombre de la sucursal son la misma sucursal, con sus datos básicos tomados de la primera. ' +
      'Al crearla se registra la sucursal, se declara en tu expediente y se da de alta cada caja: el QR de cada caja aparece en «Sucursales» ' +
      'listo para imprimir. Si algo falla a medias, corrige el Excel y vuelve a subirlo: lo que ya existe no se duplica.',
    [],
  );

  return (
    <ExcelImportModal
      open={open}
      entidad="sucursales"
      fields={CAMPOS}
      lineas={LINEAS}
      submit={submit}
      descripcion={descripcion}
      mensajeExito="Sucursales y cajas registradas. Cada caja ya tiene su QR en la lista de «Sucursales»."
      onClose={onClose}
      onImported={onImported}
    />
  );
}
