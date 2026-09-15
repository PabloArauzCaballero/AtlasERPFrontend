'use client';

import { useState } from 'react';
import { AtlasButton } from './AtlasButton';
import type { FormularioPapel } from '@/lib/formularioPapel';
import { descargarFormularioPapel } from '@/lib/pdf';
import { toast } from '@/lib/toast';

interface BotonFormularioPapelProps {
  /**
   * Se llama AL PULSAR. Es asíncrona porque resuelve los catálogos del backend para imprimirlos
   * como casillas o anexo; hacerlo al pintar costaría una llamada por formulario en cada vista.
   */
  formulario: () => Promise<FormularioPapel> | FormularioPapel;
  label?: string | undefined;
  filename?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  'data-testid'?: string | undefined;
}

/**
 * «Formulario en papel»: el mismo formulario que el usuario tiene delante, en blanco y en PDF,
 * para que alguien sin pantalla lo rellene a mano y otra persona lo transcriba después.
 *
 * Una sola pieza —gesto, estado «generando» y fallo contado— para las tres superficies que
 * declaran formularios y para las pantallas hechas a mano.
 */
export function BotonFormularioPapel({ formulario, label, filename, disabled, className, ...rest }: BotonFormularioPapelProps) {
  const [generando, setGenerando] = useState(false);

  async function descargar() {
    setGenerando(true);
    try {
      await descargarFormularioPapel(await formulario(), filename);
    } catch (error) {
      toast.error(
        'No se pudo generar el formulario en papel',
        error instanceof Error ? error.message : 'Vuelve a intentarlo en un momento.',
      );
    } finally {
      setGenerando(false);
    }
  }

  return (
    <AtlasButton
      type="button"
      variant="secondary"
      icon="print"
      className={className}
      data-testid={rest['data-testid'] ?? 'boton-formulario-papel'}
      loading={generando}
      disabled={disabled ?? false}
      onClick={() => void descargar()}
    >
      {label ?? 'Formulario en papel'}
    </AtlasButton>
  );
}
