'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { BotonFormularioPapel } from '@/components/atlas/BotonFormularioPapel';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { TranscripcionPanel } from '@/components/atlas/TranscripcionBar';
import { CATALOGO_OPERACIONES, CATALOGO_PORTAL } from '@/lib/formulariosPapel/catalogo';
import { descargarFormularioPapel } from '@/lib/pdf';
import { toast } from '@/lib/toast';

interface FormulariosPapelScreenProps {
  lado: 'portal' | 'operaciones';
}

/**
 * El cuaderno de formularios en papel de un lado del ERP.
 *
 * Para quien no va a usar la pantalla: se imprime el formulario, se rellena a mano y se entrega;
 * alguien lo transcribe después desde la pantalla indicada, con el número de serie del papel.
 */
export function FormulariosPapelScreen({ lado }: FormulariosPapelScreenProps) {
  // El catálogo se resuelve aquí y no en la página: una página de servidor no puede pasar las
  // funciones que arman cada formulario a un componente de cliente.
  const catalogo = lado === 'portal' ? CATALOGO_PORTAL : CATALOGO_OPERACIONES;
  const [imprimiendoTodo, setImprimiendoTodo] = useState(false);
  const modulos = Array.from(new Set(catalogo.map((entrada) => entrada.modulo)));

  async function imprimirTodo() {
    setImprimiendoTodo(true);
    let fallos = 0;
    for (const entrada of catalogo) {
      try {
        // Uno detrás de otro a propósito: el generador tiene un carril por petición y diez a la
        // vez sólo consiguen que todos tarden más.
        await descargarFormularioPapel(await entrada.formulario());
      } catch {
        fallos += 1;
      }
    }
    setImprimiendoTodo(false);
    if (fallos) toast.error('Algunos formularios no se generaron', `${fallos} de ${catalogo.length} fallaron. Vuelve a intentarlo uno a uno.`);
    else toast.success('Cuaderno completo', `${catalogo.length} formularios descargados.`);
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow={lado === 'portal' ? 'Portal del comercio' : 'Control'}
        title="Formularios en papel"
        description="Para rellenar a mano y entregar. Cada formulario lleva su código, versión y número de serie; con ese número se transcribe después al sistema desde la pantalla indicada."
        actions={
          <AtlasButton variant="secondary" icon="print" loading={imprimiendoTodo} onClick={() => void imprimirTodo()} data-testid="papel-cuaderno">
            Imprimir el cuaderno completo
          </AtlasButton>
        }
      />
      <InlineNotice tone="info" title="Cómo funciona">
        Imprima el formulario, entréguelo a quien va a rellenarlo y, cuando vuelva, active «Estoy transcribiendo un papel» con el número de serie del pie antes de teclearlo en su pantalla. Así el registro queda marcado como nacido en papel.
      </InlineNotice>
      <TranscripcionPanel />
      {modulos.map((modulo) => (
        <Panel key={modulo} title={modulo} icon="description">
          <ul className="divide-y divide-slate-100">
            {catalogo
              .filter((entrada) => entrada.modulo === modulo)
              .map((entrada) => (
                <li key={entrada.formCode} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`papel-entrada-${entrada.formCode}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{entrada.title}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{entrada.formCode}</span> · se transcribe en{' '}
                      <Link href={entrada.href} className="text-[#006a61] underline">{entrada.href}</Link>
                    </p>
                  </div>
                  <BotonFormularioPapel label="Imprimir" formulario={entrada.formulario} data-testid={`papel-imprimir-${entrada.formCode}`} />
                </li>
              ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
