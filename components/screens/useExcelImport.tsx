'use client';

import { useState } from 'react';
import type { MenuOption } from '@/components/atlas/OptionsMenu';
import { ExcelImportModal, type LineasSpec } from './ExcelImportModal';
import type { ActionField, FormSectionDefinition } from './StructuredActionForm';
import type { JsonObject } from '@/services/types';

/**
 * De dónde saca un listado la plantilla y el envío de su carga masiva.
 *
 * Normalmente no hace falta declararlo: si el listado da de alta en un modal, sus `create.fields`
 * y su `create.submit` ya lo son. Se declara cuando el alta vive en su PROPIA página —las que
 * llevan columna lateral o líneas dinámicas y no caben en un modal—, porque ahí el listado no
 * tiene a mano los campos. En ese caso se pasan los MISMOS que pinta el formulario de alta
 * (`camposDeSecciones(secciones)`), no una lista escrita aparte: una copia se desfasa en cuanto
 * el alta gana un campo, y esa fue exactamente la avería de las tres pantallas de «Carga masiva»
 * que esto sustituyó.
 */
export interface ExcelImportSpec {
  /** Cómo se llama lo que se importa, en plural y minúsculas. Por defecto, el título del listado. */
  entidad?: string | undefined;
  fields: ActionField[];
  submit: (payload: JsonObject) => Promise<unknown>;
  /** Para registros que llevan líneas (un asiento, un recibo, una propuesta): cómo se agrupan. */
  lineas?: LineasSpec | undefined;
}

/** Los campos de un `StructuredActionForm` en una sola lista, en el orden en que se piden. */
export function camposDeSecciones(sections: FormSectionDefinition[]): ActionField[] {
  return sections.flatMap((section) => section.fields);
}

interface Resultado {
  /** La entrada del cajón «Más», o `null` si este listado no sabe importar. */
  opcion: MenuOption | null;
  /** El modal, ya montado y cableado. Se pinta siempre; él decide si se ve. */
  modal: React.ReactNode;
}

/**
 * «Importar desde Excel» para cualquier listado, con el mismo comportamiento en todos.
 *
 * Vivía suelto dentro de `CrudDirectory`, así que los listados construidos con el otro armazón
 * —`LiveDirectoryScreen`, que es el de Cuentas B2B, Anunciantes, Campañas, Segmentos e
 * Inventario— no tenían forma de importar nada. Aquí está una vez y lo usan los dos.
 */
export function useExcelImport(
  spec: ExcelImportSpec | null | undefined,
  entidadPorDefecto: string,
  onImported: () => void,
): Resultado {
  const [abierto, setAbierto] = useState(false);

  if (!spec?.fields?.length || !spec.submit) return { opcion: null, modal: null };

  const entidad = (spec.entidad ?? entidadPorDefecto).toLowerCase();

  return {
    opcion: {
      key: 'importar',
      testId: 'crud-importar',
      tutorialId: 'crud-importar',
      label: 'Importar desde Excel',
      icon: 'upload_file',
      detail: spec.lineas
        ? `Descarga la plantilla, escribe una fila por ${spec.lineas.nombreLinea} repitiendo la clave del registro y súbela; nada se crea hasta que lo confirmas.`
        : 'Descarga la plantilla con los campos de esta pantalla, rellénala y súbela; nada se crea hasta que lo confirmas.',
      onSelect: () => setAbierto(true),
    },
    modal: (
      <ExcelImportModal
        open={abierto}
        entidad={entidad}
        fields={spec.fields}
        submit={spec.submit}
        lineas={spec.lineas}
        onClose={() => setAbierto(false)}
        onImported={onImported}
      />
    ),
  };
}
