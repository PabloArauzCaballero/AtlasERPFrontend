'use client';

import { useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { formChangeHandler, useFieldOptions } from '@/hooks/useFieldOptions';
import { formDataToPayload } from '@/lib/formPayload';
import { b2bService } from '@/services/b2bService';
import { portalService } from '@/services/portalService';
import type { JsonObject, ResourceRow } from '@/services/types';
import { ActionFieldControl, payloadDefinitions } from './ActionFieldControl';
import type { ActionField } from './StructuredActionForm';

interface Contacto {
  id: string;
  fullName: string;
  email: string | null;
  roleTitle: string | null;
  isPrimary: boolean;
}

const OTRA_PERSONA = 'otra';

function contactosDe(cuenta: ResourceRow | null): Contacto[] {
  const crudos = Array.isArray(cuenta?.contacts) ? (cuenta.contacts as ResourceRow[]) : [];
  return crudos
    .map((c) => ({
      id: String(c.id ?? ''),
      fullName: String(c.fullName ?? ''),
      email: typeof c.email === 'string' && c.email.trim() ? c.email.trim() : null,
      roleTitle: typeof c.roleTitle === 'string' && c.roleTitle.trim() ? c.roleTitle : null,
      isPrimary: Boolean(c.isPrimary),
    }))
    .filter((c) => c.id && c.fullName)
    // El principal primero: es a quien se le da el acceso casi siempre.
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

/**
 * «Dar acceso a una persona» del comercio, partiendo de los contactos que ya tiene la cuenta.
 *
 * Hasta el 2026-09-27 el formulario volvía a pedir nombre y correo en blanco, cuando la persona ya
 * se había cargado como contacto al dar de alta la cuenta (Pablo: «estamos duplicando la creación
 * de acceso y credenciales»). Ahora se elige al contacto —el principal viene marcado— y sólo se
 * teclea a mano a alguien que la cuenta todavía no tiene. El acceso sigue siendo un paso aparte y
 * explícito: no todo contacto del CRM debe poder entrar al portal del comercio.
 */
export function MerchantAccessModal({ caso, onClose, onDone }: { caso: ResourceRow; onClose: () => void; onDone: () => void | Promise<void> }) {
  const accountId = String(caso.accountId ?? '');
  const comercio = String(caso.tradeName ?? 'el comercio');
  const cargar = useCallback(() => b2bService.getAccount(accountId), [accountId]);
  const cuenta = useAsyncResource(cargar);
  const contactos = contactosDe(cuenta.data ?? null);
  const conCorreo = contactos.filter((c) => c.email);

  const [elegido, setElegido] = useState<string | null>(null);
  const seleccion = elegido ?? (conCorreo[0]?.id ?? OTRA_PERSONA);
  const aMano = seleccion === OTRA_PERSONA;

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const camposPersona: ActionField[] = [
    { name: 'fullName', label: 'Nombre completo', tooltip: 'Nombre y apellidos completos de la persona, como en su documento de identidad.', required: true, placeholder: 'Nombre del responsable' },
    { name: 'email', label: 'Correo corporativo', tooltip: 'Correo corporativo del usuario del comercio; ahí llegan las credenciales.', type: 'email', required: true, placeholder: 'usuario@empresa.com' },
  ];
  const camposAcceso: ActionField[] = [
    { name: 'roleCode', label: 'Rol', tooltip: 'Qué puede hacer la persona en el portal del comercio: operar la caja, administrar sucursales…', type: 'select', required: true, defaultValue: 'MERCHANT_OPERATOR', optionsSource: 'domain:portal.merchantUserRole' },
    {
      name: 'branchId',
      label: 'Sucursal', tooltip: 'Sucursal del comercio; sólo las habilitadas pueden originar operaciones.',
      type: 'select',
      optional: true,
      hint: 'Vacío: alcance global sobre el comercio.',
      optionsLoader: async () => {
        const rows = await portalService.listBranches(accountId);
        return [{ label: '— Alcance global —', value: '' }, ...rows.map((branch) => ({ value: String(branch.id), label: String(branch.name ?? 'Sucursal') }))];
      },
    },
  ];
  const campos = aMano ? [...camposPersona, ...camposAcceso] : camposAcceso;
  const { dynamicOptions, onFieldChange } = useFieldOptions(campos, true, null);

  const credenciales = (caso.credentials ?? {}) as { concedidas?: number; pendientes?: number };
  const yaHay = [
    Number(credenciales.concedidas ?? 0) ? `${Number(credenciales.concedidas)} acceso(s) ya concedido(s)` : '',
    Number(credenciales.pendientes ?? 0) ? `${Number(credenciales.pendientes)} esperando aprobación` : '',
  ].filter(Boolean).join(' y ');

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const payload = formDataToPayload(new FormData(event.currentTarget), payloadDefinitions(campos)) as JsonObject;
      const contacto = aMano ? null : contactos.find((c) => c.id === seleccion);
      await b2bService.createMerchantUser({
        accountId,
        ...payload,
        ...(contacto ? { fullName: contacto.fullName, email: contacto.email ?? '' } : {}),
      });
      await onDone();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo pedir el acceso. Revisa los datos.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      title={`Acceso al portal para ${comercio}`}
      description={`Elige a quién de la cuenta se le da acceso. La contraseña la genera Atlas al aprobar; el ERP nunca la ve.${yaHay ? ` Este comercio tiene ${yaHay}: cada persona entra con su propio correo.` : ''}`}
      icon="person_add"
      onClose={() => { if (!guardando) onClose(); }}
    >
      {cuenta.status === 'loading' || cuenta.status === 'idle' ? (
        <div className="flex items-center gap-2 py-6 text-xs text-slate-500"><LoadingSpinner /> Cargando los contactos de la cuenta…</div>
      ) : (
        <form onSubmit={enviar} onChange={formChangeHandler(onFieldChange)} className="space-y-4">
          {cuenta.status === 'error' ? (
            <InlineNotice tone="warning" title="No se pudieron leer los contactos">Puedes escribir los datos de la persona a mano.</InlineNotice>
          ) : null}

          <fieldset className="space-y-1.5" data-testid="acceso-contactos">
            <legend className="mb-1.5 text-xs font-bold text-slate-700">Persona</legend>
            {contactos.map((c) => {
              const deshabilitado = !c.email;
              const activo = seleccion === c.id;
              return (
                <label
                  key={c.id}
                  className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-xs transition ${deshabilitado ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : activo ? 'cursor-pointer border-primary bg-primary-wash text-slate-800' : 'cursor-pointer border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <input type="radio" name="contacto" value={c.id} checked={activo} disabled={deshabilitado} onChange={() => setElegido(c.id)} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {c.fullName}
                      {c.isPrimary ? <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">Principal</span> : null}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {c.email ?? 'Sin correo: agrégaselo en la ficha de la cuenta para poder darle acceso.'}
                      {c.roleTitle ? ` · ${c.roleTitle}` : ''}
                    </span>
                  </span>
                </label>
              );
            })}
            <label className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-xs transition cursor-pointer ${aMano ? 'border-primary bg-primary-wash text-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <input type="radio" name="contacto" value={OTRA_PERSONA} checked={aMano} onChange={() => setElegido(OTRA_PERSONA)} className="mt-0.5" />
              <span>
                <span className="flex items-center gap-1 font-semibold"><Icon name="person_add" className="text-[15px]" /> Otra persona</span>
                <span className="block text-[11px] text-slate-500">Alguien que todavía no está entre los contactos de la cuenta, por ejemplo quien atiende una caja.</span>
              </span>
            </label>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {campos.map((field) => (
              <ActionFieldControl key={field.name} field={field} className="" dynamicOptions={dynamicOptions} defaultValue={field.defaultValue} />
            ))}
          </div>

          {error ? <InlineNotice tone="danger" title="No se pudo pedir el acceso">{error}</InlineNotice> : null}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <AtlasButton variant="secondary" type="button" onClick={onClose} disabled={guardando}>Cancelar</AtlasButton>
            <AtlasButton type="submit" icon="send" loading={guardando}>Pedir acceso</AtlasButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
