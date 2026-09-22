'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { StatusPill } from '@/components/atlas/StatusPill';
import { descargarPlantillaExcel, leerTabla } from '@/lib/excel';
import {
  agrupar,
  camposImportables,
  ejemploDe,
  prepararPlana,
  type LineasSpec,
  type RegistroPreparado,
} from '@/lib/importacionExcel';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import type { ActionField } from './StructuredActionForm';
import type { JsonObject } from '@/services/types';

interface ExcelImportModalProps {
  open: boolean;
  /** Cómo se llama lo que se importa, en plural y en minúsculas: «cuentas B2B», «contratos». */
  entidad: string;
  /** Los MISMOS campos del alta: la plantilla y la validación salen de ahí, no de una lista aparte. */
  fields: ActionField[];
  /** El MISMO envío del alta: una fila importada recorre el camino de un alta hecha a mano. */
  submit: (payload: JsonObject) => Promise<unknown>;
  /** Si el registro lleva líneas, cómo se agrupan las filas de la hoja. */
  lineas?: LineasSpec | undefined;
  onClose: () => void;
  /** Se llama al cerrar si se creó al menos un registro, para recargar la tabla. */
  onImported: () => void;
}

const TOPE_FILAS = 500;

/**
 * Importar registros desde un Excel, en la pantalla del propio registro.
 *
 * Antes la carga masiva era TRES pantallas sueltas del menú —cuentas, anunciantes, documentos—,
 * cada una con su plantilla escrita a mano en el código y sólo para esos tres tipos. El resto de
 * los registros del ERP no se podían cargar de ninguna forma que no fuese uno a uno. Aquí la
 * plantilla y las validaciones se derivan de los campos del alta de CADA pantalla, así que todo
 * directorio que sepa crear un registro sabe importarlo, y el día que un alta gane un campo, la
 * plantilla lo gana sola.
 *
 * Las filas se envían **de una en una por el mismo endpoint del alta**, no por un lote. Es más
 * lento y es a propósito: el alta ya lleva las validaciones, los disparadores y la auditoría del
 * backend, así que una fila importada no es un registro de segunda. Y cuando una falla, se sabe
 * cuál y por qué, en vez de perder las cien porque la fila 34 traía un NIT repetido.
 */
export function ExcelImportModal(props: ExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [filas, setFilas] = useState<RegistroPreparado[]>([]);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [terminado, setTerminado] = useState(false);

  const lineas = props.lineas;
  const declarados = useMemo(() => camposImportables(props.fields), [props.fields]);
  const declaradosLinea = useMemo(() => (lineas ? camposImportables(lineas.fields) : []), [lineas]);

  /*
   * Los valores que admite cada select, traídos del backend igual que los trae el formulario.
   *
   * Sin esto, un campo cuyas opciones vienen del catálogo —el ejecutivo responsable de una cuenta,
   * la cuenta contable de una línea— exigía escribir el UUID en la celda: nadie lo sabe, no hay
   * dónde mirarlo, y la fila se rechazaba con un mensaje del backend que no decía qué poner. Con
   * las opciones cargadas, la plantilla puede traer un ejemplo válido y la celda acepta también
   * el NOMBRE de la opción, que es lo que una persona tiene delante.
   */
  const { dynamicOptions } = useFieldOptions([...declarados, ...declaradosLinea], props.open);
  const conOpciones = useCallback(
    (lista: ActionField[]) => lista.map((campo) => {
      const opciones = campo.options ?? dynamicOptions[campo.name];
      return opciones?.length ? { ...campo, options: opciones } : campo;
    }),
    [dynamicOptions],
  );
  const campos = useMemo(() => conOpciones(declarados), [conOpciones, declarados]);
  const camposLinea = useMemo(() => conOpciones(declaradosLinea), [conOpciones, declaradosLinea]);
  const obligatorios = useMemo(() => campos.filter((campo) => campo.required && !campo.optional), [campos]);
  const obligatoriosLinea = useMemo(
    () => camposLinea.filter((campo) => campo.required && !campo.optional),
    [camposLinea],
  );
  /** Las columnas de la plantilla, en orden: la clave del registro, su cabecera y sus líneas. */
  const columnas = useMemo(
    () => (lineas ? [lineas.clave, ...campos.map((c) => c.name), ...camposLinea.map((c) => c.name)] : campos.map((c) => c.name)),
    [lineas, campos, camposLinea],
  );
  const validas = filas.filter((fila) => fila.errores.length === 0);
  const creadas = filas.filter((fila) => fila.estado === 'creada').length;
  const fallidas = filas.filter((fila) => fila.estado === 'fallida');

  function cerrar() {
    if (importando) return;
    if (creadas > 0) props.onImported();
    setFilas([]);
    setNombreArchivo('');
    setErrorArchivo('');
    setProgreso(0);
    setTerminado(false);
    props.onClose();
  }

  function descargarPlantilla() {
    const nombre = `plantilla-${props.entidad.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
    if (!lineas) {
      descargarPlantillaExcel(nombre, columnas, [campos.map(ejemploDe)]);
      return;
    }
    /*
     * Dos filas de ejemplo con la MISMA clave: es la única forma de enseñar, sin un párrafo de
     * instrucciones, que un asiento de dos líneas se escribe en dos filas y que la cabecera sólo
     * cuenta en la primera.
     */
    const clave = lineas.ejemploClave ?? 'DOC-001';
    const cabecera = campos.map(ejemploDe);
    const vacia = campos.map(() => '');
    descargarPlantillaExcel(nombre, columnas, [
      [clave, ...cabecera, ...camposLinea.map(ejemploDe)],
      [clave, ...vacia, ...camposLinea.map(ejemploDe)],
    ]);
  }

  async function cargar(file?: File) {
    if (!file) return;
    setErrorArchivo('');
    setTerminado(false);
    setNombreArchivo(file.name);
    try {
      const tabla = await leerTabla(file);
      if (!tabla.filas.length) {
        setFilas([]);
        setErrorArchivo('El archivo no trae ninguna fila con datos debajo de las cabeceras.');
        return;
      }
      const exigidas = [...(lineas ? [lineas.clave] : []), ...obligatorios.map((campo) => campo.name), ...obligatoriosLinea.map((campo) => campo.name)];
      const faltantes = exigidas.filter((nombre) => !tabla.cabeceras.includes(nombre));
      if (faltantes.length) {
        setFilas([]);
        setErrorArchivo(`Al archivo le faltan columnas obligatorias: ${faltantes.join(', ')}. Descarga la plantilla y vuelve a intentarlo.`);
        return;
      }
      const recortadas = tabla.filas.slice(0, TOPE_FILAS);
      setFilas(lineas
        ? agrupar(recortadas, lineas, campos, obligatorios, camposLinea, obligatoriosLinea)
        : recortadas.map((crudo, indice) => prepararPlana(crudo, indice + 2, campos, obligatorios)));
    } catch (error) {
      setFilas([]);
      setErrorArchivo(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    }
  }

  async function importar() {
    setImportando(true);
    setProgreso(0);
    const pendientes = filas.filter((fila) => fila.errores.length === 0 && fila.estado !== 'creada');
    for (const fila of pendientes) {
      try {
        await props.submit(fila.payload);
        marcar(setFilas, fila.numero, { estado: 'creada', detalle: undefined });
      } catch (error) {
        marcar(setFilas, fila.numero, { estado: 'fallida', detalle: error instanceof Error ? error.message : 'Error desconocido' });
      }
      setProgreso((valor) => valor + 1);
    }
    setImportando(false);
    setTerminado(true);
  }

  const total = validas.length;
  const columnasPreview = campos.slice(0, lineas ? 3 : 4);

  return (
    <Modal
      open={props.open}
      title={`Importar ${props.entidad} desde Excel`}
      icon="upload_file"
      onClose={cerrar}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {lineas
            ? `Se crean los mismos registros que con el formulario de alta. Va una fila por ${lineas.nombreLinea}: las filas que repiten «${lineas.claveLabel}» son el mismo registro, y la cabecera se lee de la primera de ellas.`
            : 'Se crean los mismos registros que con el formulario de alta, uno por fila. Descarga la plantilla, rellénala en Excel y súbela: antes de crear nada verás qué filas están completas y cuáles no.'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <AtlasButton variant="secondary" icon="download" data-testid="importar-plantilla" onClick={descargarPlantilla}>
            Descargar plantilla
          </AtlasButton>
          <span className="text-xs text-slate-500">
            {columnas.length} columnas · {obligatorios.length + obligatoriosLinea.length + (lineas ? 1 : 0)} obligatorias · hasta {TOPE_FILAS} filas por archivo
          </span>
        </div>

        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          data-testid="importar-archivo"
          onChange={(event) => void cargar(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); void cargar(event.dataTransfer.files[0]); }}
          className="grid min-h-32 w-full place-items-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center hover:border-[#006a61] hover:bg-primary-wash"
        >
          <div>
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white text-[#006a61] shadow-sm ring-1 ring-slate-200">
              <Icon name="cloud_upload" className="text-[24px]" />
            </span>
            <p className="mt-2 text-sm font-bold text-slate-800">Arrastra aquí el Excel</p>
            <p className="mt-0.5 text-xs text-slate-500">o haz clic para buscarlo. Acepta .xlsx y .csv</p>
            {nombreArchivo ? <p className="mt-2 font-mono text-[11px] text-teal-700">{nombreArchivo}</p> : null}
          </div>
        </button>

        {errorArchivo ? <InlineNotice tone="danger" title="No se pudo usar el archivo">{errorArchivo}</InlineNotice> : null}

        {filas.length ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusPill tone="success">{validas.length} listas para crear</StatusPill>
              {filas.length - validas.length ? <StatusPill tone="warning">{filas.length - validas.length} incompletas</StatusPill> : null}
              {creadas ? <StatusPill tone="success">{creadas} creadas</StatusPill> : null}
              {fallidas.length ? <StatusPill tone="danger">{fallidas.length} rechazadas</StatusPill> : null}
            </div>

            <div className="table-scroll max-h-64 overflow-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Fila</th>
                    {lineas ? <th className="px-2 py-2">{lineas.claveLabel}</th> : null}
                    {columnasPreview.map((campo) => <th className="px-2 py-2" key={campo.name}>{campo.label}</th>)}
                    {lineas ? <th className="px-2 py-2">Líneas</th> : null}
                    <th className="px-2 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((fila) => (
                    <tr key={fila.numero} className={fila.errores.length || fila.estado === 'fallida' ? 'bg-red-50/50' : undefined}>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{fila.numero}</td>
                      {lineas ? <td className="max-w-32 truncate px-2 py-1.5 font-mono text-[10px]">{fila.etiqueta}</td> : null}
                      {columnasPreview.map((campo) => (
                        <td className="max-w-40 truncate px-2 py-1.5" key={campo.name}>{fila.crudo[campo.name] || '—'}</td>
                      ))}
                      {lineas ? <td className="px-2 py-1.5 text-slate-500">{fila.filasHoja.length}</td> : null}
                      <td className="px-2 py-1.5">
                        {fila.errores.length ? <span className="font-semibold text-red-700">{fila.errores.join(', ')}</span>
                          : fila.estado === 'creada' ? <span className="font-semibold text-emerald-700">Creada</span>
                          : fila.estado === 'fallida' ? <span className="font-semibold text-red-700">{fila.detalle}</span>
                          : <span className="text-slate-500">Lista</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {terminado ? (
          <InlineNotice tone={fallidas.length ? 'warning' : 'success'} title={`${creadas} de ${total} registros creados`}>
            {fallidas.length
              ? 'Las filas rechazadas siguen en la tabla con el motivo. Corrígelas en el Excel y vuelve a subirlo: las que ya se crearon no se repiten porque no vuelven a enviarse.'
              : 'Todas las filas del archivo entraron por el mismo camino que un alta hecha a mano.'}
          </InlineNotice>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          {importando ? <span className="mr-auto text-xs text-slate-500">Creando {progreso} de {total}…</span> : null}
          <AtlasButton variant="secondary" onClick={cerrar} disabled={importando}>{terminado ? 'Cerrar' : 'Cancelar'}</AtlasButton>
          <AtlasButton
            icon="publish"
            data-testid="importar-confirmar"
            loading={importando}
            disabled={!validas.length || terminado}
            onClick={() => void importar()}
          >
            Crear {total} registros
          </AtlasButton>
        </div>
      </div>
    </Modal>
  );
}

function marcar(
  set: React.Dispatch<React.SetStateAction<RegistroPreparado[]>>,
  numero: number,
  cambio: Partial<RegistroPreparado>,
): void {
  set((actuales) => actuales.map((fila) => (fila.numero === numero ? { ...fila, ...cambio } : fila)));
}

export type { LineasSpec };
