'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { peekOptions, resolveOptions } from '@/services/domains';
import type { Option } from '@/services/optionLoaders';
import { toast } from '@/lib/toast';

export type DynamicOptions = Record<string, Option[]>;

/**
 * Las opciones de los selects de un formulario declarativo, resueltas en un solo sitio.
 *
 * `StructuredActionForm`, `InlineActionForm`, `ActionFormModal` y `MultiActionWorkspace` tenían
 * cada uno una copia del mismo efecto, y las cuatro terminaban en `.catch(() => {})`: si el
 * catálogo no cargaba, el select obligatorio quedaba vacío y el formulario no se podía enviar sin
 * decir por qué. Aquí se resuelven las tres fuentes de un campo:
 *
 * - `optionsLoader` — filas del backend (cuentas, socios…), una vez.
 * - `optionsSource` — un dominio cerrado del backend o un catálogo geográfico, una vez; si ya
 *   estaba en memoria, desde el primer render.
 * - `dependsOn` + `optionsLoaderFor` — opciones que dependen de otro campo (el tipo de entidad
 *   decide qué entidades se listan). Se recargan cada vez que ese campo cambia.
 *
 * Un fallo avisa con el nombre del campo.
 */
export function useFieldOptions(
  fields: readonly ActionField[],
  active = true,
  initialValues?: Record<string, unknown> | null,
): { dynamicOptions: DynamicOptions; onFieldChange: (name: string, value: string) => void } {
  const [dynamicOptions, setDynamicOptions] = useState<DynamicOptions>(() => {
    const ready: DynamicOptions = {};
    for (const field of fields) {
      const peeked = field.optionsSource ? peekOptions(field.optionsSource) : undefined;
      if (peeked) ready[field.name] = peeked;
    }
    return ready;
  });
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  // Cada campo dependiente descarta respuestas de una elección anterior del campo del que depende.
  const requestIds = useRef<Record<string, number>>({});

  const assign = useCallback((name: string, options: Option[]) => {
    setDynamicOptions((current) => ({ ...current, [name]: options }));
  }, []);

  const fail = useCallback((field: ActionField, error: unknown) => {
    toast.error(
      `No se pudieron cargar las opciones de «${field.label}»`,
      error instanceof Error ? error.message : 'No se pudo contactar el servidor.',
    );
  }, []);

  const loadDependent = useCallback(
    (field: ActionField, parentValue: string) => {
      const requestId = (requestIds.current[field.name] ?? 0) + 1;
      requestIds.current[field.name] = requestId;
      if (!parentValue || !field.optionsLoaderFor) {
        assign(field.name, []);
        return;
      }
      field
        .optionsLoaderFor(parentValue)
        .then((options) => {
          if (requestIds.current[field.name] === requestId) assign(field.name, options);
        })
        .catch((error: unknown) => {
          if (requestIds.current[field.name] === requestId) fail(field, error);
        });
    },
    [assign, fail],
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    for (const field of fieldsRef.current) {
      if (field.dependsOn) {
        const parent = fieldsRef.current.find((candidate) => candidate.name === field.dependsOn);
        const initial = initialValues?.[field.dependsOn] ?? parent?.defaultValue;
        if (initial !== undefined && initial !== null && String(initial) !== '') {
          loadDependent(field, String(initial));
        }
        continue;
      }
      const pending = field.optionsLoader
        ? field.optionsLoader()
        : field.optionsSource
          ? resolveOptions(field.optionsSource)
          : null;
      pending
        ?.then((options) => {
          if (!cancelled) assign(field.name, options);
        })
        .catch((error: unknown) => {
          if (!cancelled) fail(field, error);
        });
    }
    return () => {
      cancelled = true;
    };
    // Las opciones se resuelven al activarse el formulario (montar o abrir el modal); los campos
    // declarados no cambian en tiempo de ejecución.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onFieldChange = useCallback(
    (name: string, value: string) => {
      for (const field of fieldsRef.current) {
        if (field.dependsOn === name) loadDependent(field, value);
      }
    },
    [loadDependent],
  );

  return { dynamicOptions, onFieldChange };
}

/** `onChange` del `<form>`: los cambios de cualquier control llegan aquí por burbujeo. */
export function formChangeHandler(onFieldChange: (name: string, value: string) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target?.name) onFieldChange(target.name, target.value);
  };
}
