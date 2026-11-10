'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { cn } from '@/lib/cn';
import { aplicarTema, guardarPreferencia, leerPreferencia, type PreferenciaDeTema } from '@/lib/tema';

const OPCIONES: ReadonlyArray<{ valor: PreferenciaDeTema; etiqueta: string; icono: string }> = [
  { valor: 'light', etiqueta: 'Claro', icono: 'light_mode' },
  { valor: 'dark', etiqueta: 'Oscuro', icono: 'dark_mode' },
  { valor: 'system', etiqueta: 'Sistema', icono: 'computer' },
];

/**
 * Conmutador claro / oscuro / sistema.
 *
 * La elección se guarda y se aplica en el acto (`lib/tema.ts`). El estado arranca en `null` y se
 * lee tras montar: en el servidor no hay almacenamiento, y pintar una opción marcada que luego
 * cambia sería una discrepancia de hidratación.
 */
export function SelectorDeTema({ className }: Readonly<{ className?: string }>) {
  const [preferencia, setPreferencia] = useState<PreferenciaDeTema | null>(null);

  useEffect(() => setPreferencia(leerPreferencia()), []);

  // Con «Sistema», el portal sigue al sistema operativo también si cambia con la página abierta.
  useEffect(() => {
    if (preferencia !== 'system' || typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = () => aplicarTema('system');
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, [preferencia]);

  return (
    <div
      role="radiogroup"
      aria-label="Apariencia"
      data-testid="selector-de-tema"
      className={cn('inline-flex rounded-md border border-slate-400 bg-white p-0.5', className)}
    >
      {OPCIONES.map((opcion) => {
        const elegida = preferencia === opcion.valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={elegida}
            data-testid={`tema-${opcion.valor}`}
            onClick={() => {
              guardarPreferencia(opcion.valor);
              setPreferencia(opcion.valor);
            }}
            className={cn(
              'atlas-tap inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors',
              elegida ? 'bg-brand-soft text-slate-900' : 'text-slate-600 hover:bg-surface-sunken hover:text-slate-900',
            )}
          >
            <Icon name={opcion.icono} className="text-[16px]" />
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
