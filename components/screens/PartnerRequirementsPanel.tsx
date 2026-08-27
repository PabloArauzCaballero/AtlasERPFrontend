'use client';

import { useRef } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Panel } from '@/components/atlas/Panel';
import { partnerOnboardingService, uploadQrFile } from '@/services/partnerOnboardingService';

interface PartnerRequirementsPanelProps {
  partnerId: string;
  /** Claves de los requisitos que el expediente declara pendientes. */
  pendientes: readonly string[];
  ocupado: boolean;
  /** Ejecuta la acción, recarga el expediente y cuenta cómo fue. Lo aporta la pantalla. */
  run: (label: string, action: () => Promise<unknown>) => Promise<void>;
}

/**
 * Los requisitos que faltan, con el formulario para resolverlos al lado.
 *
 * El expediente sabía decir «falta la matrícula de comercio» y «falta declarar al representante
 * legal» desde el primer día, pero no había ninguna pantalla donde darlos: las rutas existían en
 * AtlasBackend y la pasarela del ERP no las reenviaba, así que el aviso era un callejón sin salida
 * —el comercio leía lo que le faltaba y no podía hacer nada al respecto—.
 *
 * Cada bloque aparece SÓLO si su requisito está pendiente. Enseñar los tres siempre convertiría la
 * pantalla en un formulario largo del que la mayoría ya está resuelta, y esconder el que falta es
 * exactamente el problema que esto viene a cerrar.
 */
export function PartnerRequirementsPanel({ partnerId, pendientes, ocupado, run }: PartnerRequirementsPanelProps) {
  const poder = useRef<HTMLInputElement>(null);

  const faltaMatricula = pendientes.includes('commercial_registry');
  const faltaRepresentante = pendientes.includes('legal_representative');
  const faltaPoder = pendientes.includes('power_of_attorney');

  if (!faltaMatricula && !faltaRepresentante && !faltaPoder) return null;

  async function guardarMatricula(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const matricula = String(form.get('commercialRegistry') ?? '').trim();
    if (!matricula) return;
    await run('Matrícula de comercio', () =>
      partnerOnboardingService.setCommercialRegistry(partnerId, matricula),
    );
  }

  /**
   * Declara al representante y, si adjuntó el poder, lo sube antes.
   *
   * En ese orden: el backend comprueba que el objeto existe y que es de este expediente antes de
   * guardar la clave, así que declarar primero y subir después dejaría una representación
   * afirmada sin respaldo, que es justo lo que el requisito del poder existe para impedir.
   */
  async function guardarRepresentante(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const archivo = poder.current?.files?.[0];

    await run('Representante legal', async () => {
      let powerOfAttorneyKey: string | undefined;
      if (archivo) {
        const ticket = await partnerOnboardingService.createDocumentUploadUrl(partnerId, {
          documentKind: 'power-of-attorney',
          contentType:
            archivo.type === 'application/pdf'
              ? 'application/pdf'
              : archivo.type === 'image/png'
                ? 'image/png'
                : 'image/jpeg',
          sizeBytes: archivo.size,
        });
        await uploadQrFile(ticket, archivo);
        powerOfAttorneyKey = ticket.storageKey;
      }
      return partnerOnboardingService.addLegalRepresentative(partnerId, {
        fullName: String(form.get('fullName') ?? '').trim(),
        documentType: String(form.get('documentType') ?? 'ci'),
        documentNumber: String(form.get('documentNumber') ?? '').trim(),
        ...(powerOfAttorneyKey ? { powerOfAttorneyKey } : {}),
      });
    });
  }

  return (
    <div className="space-y-4">
      {faltaMatricula ? (
        <Panel
          title="Matrícula de comercio"
          icon="badge"
          description="El número con el que tu empresa está inscrita en el registro de comercio. Es lo único del alta que se puede completar después."
        >
          <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" onSubmit={guardarMatricula}>
            <FormField
              label="Número de matrícula"
              name="commercialRegistry"
              required
              placeholder="00123456"
              data-testid="campo-matricula"
            />
            <AtlasButton type="submit" icon="save" disabled={ocupado} data-testid="btn-guardar-matricula">
              Guardar matrícula
            </AtlasButton>
          </form>
        </Panel>
      ) : null}

      {faltaRepresentante || faltaPoder ? (
        <Panel
          title="Representante legal"
          icon="person"
          description={
            faltaRepresentante
              ? 'Quién firma en nombre de la empresa. Puedes guardarlo ahora y adjuntar el poder cuando lo tengas escaneado.'
              : 'Ya declaraste al representante, pero falta el poder que lo acredita: declararlo no es acreditarlo.'
          }
        >
          <form className="grid gap-3 md:grid-cols-2" onSubmit={guardarRepresentante}>
            <FormField
              label="Nombre completo"
              name="fullName"
              required
              className="md:col-span-2"
              placeholder="Nombre y apellidos como figuran en el documento"
              data-testid="campo-representante-nombre"
            />
            <FormField
              kind="select"
              label="Tipo de documento"
              name="documentType"
              defaultValue="ci"
              options={[
                { label: 'Cédula de identidad', value: 'ci' },
                { label: 'Pasaporte', value: 'passport' },
                { label: 'Documento extranjero', value: 'foreign_id' },
              ]}
            />
            <FormField
              label="Número de documento"
              name="documentNumber"
              required
              placeholder="1234567"
              data-testid="campo-representante-documento"
            />
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                Poder notarial {faltaPoder ? <span className="text-red-600">*</span> : null}
              </span>
              <input
                ref={poder}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="text-xs"
                data-testid="campo-poder"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                PDF o imagen del poder, hasta 10 MB. Se guarda como evidencia del expediente; sin él no se puede
                enviar a revisión.
              </span>
            </label>
            <div className="md:col-span-2 flex justify-end">
              <AtlasButton type="submit" icon="save" disabled={ocupado} data-testid="btn-guardar-representante">
                Guardar representante
              </AtlasButton>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
