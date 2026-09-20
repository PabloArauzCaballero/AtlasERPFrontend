'use client';

import { Icon } from './Icon';
import { Modal } from './Modal';

export interface MenuOption {
  key: string;
  label: string;
  icon: string;
  /** Qué hace, en una línea. Un «CSV» suelto no lo decía. */
  detail?: string | undefined;
  disabled?: boolean | undefined;
  testId?: string | undefined;
  tutorialId?: string | undefined;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  /** De qué pantalla son estas opciones; va bajo el título del cajón. */
  description?: string | undefined;
  options: MenuOption[];
  onClose: () => void;
}

/**
 * El cajón de lo que no es la acción principal de una pantalla.
 *
 * Exportar, importar o refrescar son salidas ocasionales y ocupaban cuatro botones en la
 * cabecera de CADA listado, por delante del botón que sí se viene a pulsar. Aquí caben con su
 * nombre escrito y una línea de explicación, que es más de lo que decía un «CSV» a secas.
 *
 * Es un modal y no un desplegable anclado al botón porque la barra de la cabecera se desplaza en
 * horizontal (`overflow-x: auto`): cualquier capa posicionada dentro queda recortada en cuanto no
 * cabe, que es justo lo que pasa en pantallas estrechas.
 */
export function OptionsMenu({ open, description, options, onClose }: Props) {
  if (!open) return null;
  return (
    <Modal open title="Más opciones" description={description} icon="more_horiz" width="md" onClose={onClose}>
      <div className="space-y-1.5">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={option.disabled}
            data-testid={option.testId}
            data-tutorial-id={option.tutorialId}
            className="flex w-full items-start gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-slate-200 disabled:hover:bg-white"
            onClick={() => {
              /* Primero cierra: el formulario que abre la opción y este cajón no pueden convivir,
                 y dejarlos apilados atrapa el foco entre los dos. */
              onClose();
              option.onSelect();
            }}
          >
            <Icon name={option.icon} className="mt-0.5 text-[18px] text-slate-500" />
            <span className="min-w-0">
              <b className="block text-xs font-bold text-slate-800">{option.label}</b>
              {option.detail ? <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{option.detail}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
