'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

export interface TabDefinition {
  id: string;
  label: string;
  icon?: string | undefined;
  /** Contador opcional a la derecha de la etiqueta (registros, pendientes…). */
  badge?: string | number | undefined;
  content: React.ReactNode;
}

interface TabbedPanelsProps {
  tabs: TabDefinition[];
  initialId?: string | undefined;
  /**
   * Mantiene montadas las pestañas inactivas y sólo las oculta con CSS.
   *
   * Necesario cuando dentro hay formularios: desmontar la pestaña borra lo que el usuario llevaba
   * escrito, y volver a ella deja los campos en blanco sin explicar por qué.
   */
  keepMounted?: boolean | undefined;
  className?: string | undefined;
  /** Modo controlado: la pestaña activa la decide quien lo usa (para saltar a ella desde fuera). */
  activeId?: string | undefined;
  onChange?: ((id: string) => void) | undefined;
}

/**
 * Varias secciones en pestañas en lugar de tarjetas apiladas.
 *
 * Una pantalla con seis paneles seguidos obliga a recorrer con la rueda del ratón para saber qué
 * hay, y lo que importa —lo que se está mirando ahora— queda a media pantalla de distancia. Con
 * pestañas todo el inventario de la vista se lee de un golpe en la primera línea.
 */
export function TabbedPanels({ tabs, initialId, keepMounted = false, className, activeId, onChange }: TabbedPanelsProps) {
  const first = initialId ?? tabs[0]?.id ?? '';
  const [internalId, setInternalId] = useState(first);
  const currentId = activeId ?? internalId;
  const select = (id: string) => { if (onChange) onChange(id); else setInternalId(id); };
  const active = tabs.find((tab) => tab.id === currentId) ?? tabs[0];

  if (!tabs.length) return null;

  return (
    <div className={cn('space-y-4', className)}>
      <div role="tablist" aria-label="Secciones" className="atlas-rail -mx-1 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {tabs.map((tab) => {
          const selected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`tab-${tab.id}`}
              onClick={() => select(tab.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition',
                selected ? 'bg-primary-wash text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
              )}
            >
              {tab.icon ? <Icon name={tab.icon} className="text-[16px]" /> : null}
              {tab.label}
              {tab.badge !== undefined && tab.badge !== '' ? (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', selected ? 'bg-white/70 text-primary' : 'bg-slate-100 text-slate-600')}>{tab.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {keepMounted
        ? tabs.map((tab) => <div key={tab.id} role="tabpanel" hidden={tab.id !== active?.id} className={tab.id === active?.id ? '' : 'hidden'}>{tab.content}</div>)
        : <div role="tabpanel">{active?.content}</div>}
    </div>
  );
}
