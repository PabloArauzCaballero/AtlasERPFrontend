'use client';

import { useMemo, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { StatusPill } from '@/components/atlas/StatusPill';
import { descargarPlantillaExcel, fechaDeSerieExcel, leerTabla } from '@/lib/excel';
import { formDataToPayload } from '@/lib/formPayload';
import { payloadDefinitions } from './ActionFieldControl';
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
  onClose: () => void;
  /** Se llama al cerrar si se creó al menos un registro, para recargar la tabla. */
  onImported: () => void;
}

interface FilaPreparada {
  numero: number;
  crudo: Record<string, string>;
  payload: JsonObject;
  errores: string[];
  estado: 'pendiente' | 'creada' | 'fallida';
  detalle?: string | undefined;
}

const TOPE_FILAS = 500;

/** Los campos que se piden en la plantilla: lo que el sistema asigna solo no se importa. */
function camposImportables(fields: ActionField[]): ActionField[] {
  return fields.filter((field) => !field.assignedByBackend && field.type !== 'address');
}

/** Un ejemplo por columna, para que la plantilla enseñe el formato en vez de describirlo. */
function ejemploDe(field: ActionField): string {
  if (field.defaultValue !== undefined && field.defaultValue !== '') return String(field.defaultValue);
  if (field.options?.length) return field.options[0]?.value ?? '';
  if (field.type === 'date') return '2026-01-31';
  if (field.type === 'datetime') return '2026-01-31T14:30';
  if (field.type === 'number') return '0';
  if (field.type === 'multiselect' || field.type === 'chips') return 'VALOR1, VALOR2';
  return field.placeholder ?? '';
}

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
  const [filas, setFilas] = useState<FilaPreparada[]>([]);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [terminado, setTerminado] = useState(false);

  const campos = useMemo(() => camposImportables(props.fields), [props.fields]);
  const obligatorios = useMemo(() => campos.filter((campo) => campo.required && !campo.optional), [campos]);
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
      const faltantes = obligatorios
        .filter((campo) => !tabla.cabeceras.includes(campo.name))
        .map((campo) => campo.name);
      if (faltantes.length) {
        setFilas([]);
        setErrorArchivo(`Al archivo le faltan columnas obligatorias: ${faltantes.join(', ')}. Descarga la plantilla y vuelve a intentarlo.`);
        return;
      }
      setFilas(tabla.filas.slice(0, TOPE_FILAS).map((crudo, indice) => preparar(crudo, indice + 2, campos, obligatorios)));
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
  const plantilla = `plantilla-${props.entidad.replace(/\s+/g, '-').toLowerCase()}.xlsx`;

  return (
    <Modal
      open={props.open}
      title={`Importar ${props.entidad} desde Excel`}
      icon="upload_file"
      onClose={cerrar}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Se crean los mismos registros que con el formulario de alta, uno por fila. Descarga la plantilla,
          rellénala en Excel y súbela: antes de crear nada verás qué filas están completas y cuáles no.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <AtlasButton
            variant="secondary"
            icon="download"
            data-testid="importar-plantilla"
            onClick={() => descargarPlantillaExcel(plantilla, campos.map((campo) => campo.name), campos.map(ejemploDe))}
          >
            Descargar plantilla
          </AtlasButton>
          <span className="text-xs text-slate-500">
            {campos.length} columnas · {obligatorios.length} obligatorias · hasta {TOPE_FILAS} filas por archivo
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
                    {campos.slice(0, 4).map((campo) => <th className="px-2 py-2" key={campo.name}>{campo.label}</th>)}
                    <th className="px-2 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((fila) => (
                    <tr key={fila.numero} className={fila.errores.length || fila.estado === 'fallida' ? 'bg-red-50/50' : undefined}>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{fila.numero}</td>
                      {campos.slice(0, 4).map((campo) => (
                        <td className="max-w-40 truncate px-2 py-1.5" key={campo.name}>{fila.crudo[campo.name] || '—'}</td>
                      ))}
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
  set: React.Dispatch<React.SetStateAction<FilaPreparada[]>>,
  numero: number,
  cambio: Partial<FilaPreparada>,
): void {
  set((actuales) => actuales.map((fila) => (fila.numero === numero ? { ...fila, ...cambio } : fila)));
}

/**
 * Una fila del Excel convertida al mismo payload que produce el formulario.
 *
 * Reutiliza `formDataToPayload` con las definiciones del alta en vez de construir el objeto a
 * mano: así los números llegan como números, las listas separadas por coma como arrays, los
 * nombres con punto (`primaryContact.email`) como objetos anidados, y nada de eso se puede
 * desincronizar con lo que hace el formulario, porque es la misma función.
 */
function preparar(
  crudo: Record<string, string>,
  numero: number,
  campos: ActionField[],
  obligatorios: ActionField[],
): FilaPreparada {
  const errores = obligatorios
    .filter((campo) => !(crudo[campo.name] ?? '').trim())
    .map((campo) => `Falta «${campo.label}»`);

  const datos = new FormData();
  for (const campo of campos) {
    const valor = (crudo[campo.name] ?? '').trim();
    if (valor === '') continue;
    datos.set(campo.name, normalizar(valor, campo));
  }

  /*
   * Un valor fuera del dominio se caza aquí y no en el backend: el error «status must be one of…»
   * llega sin número de fila, y con cien filas eso no dice cuál corregir. Sólo se comprueban los
   * campos con lista fija en el código; los que la piden al catálogo se validan en el servidor.
   */
  for (const campo of campos) {
    const valor = (crudo[campo.name] ?? '').trim();
    if (!valor || !campo.options?.length) continue;
    if (!campo.options.some((opcion) => opcion.value === valor)) {
      errores.push(`«${campo.label}» no admite «${valor}»`);
    }
  }

  return {
    numero,
    crudo,
    payload: formDataToPayload(datos, payloadDefinitions(campos)) as JsonObject,
    errores,
    estado: 'pendiente',
  };
}

/** Lo que Excel entrega distinto de lo que el formulario entregaría. */
function normalizar(valor: string, campo: ActionField): string {
  // Una celda con formato de fecha llega como número de serie («46020»), no como texto.
  if ((campo.type === 'date' || campo.type === 'datetime') && /^\d{5}(\.\d+)?$/.test(valor)) {
    return fechaDeSerieExcel(Number(valor));
  }
  // Excel escribe los decimales con coma en configuración regional española; el backend pide punto.
  if ((campo.type === 'number' || campo.valueKind === 'number') && /^-?\d+,\d+$/.test(valor)) {
    return valor.replace(',', '.');
  }
  return valor;
}
