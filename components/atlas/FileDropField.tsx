'use client';

import { useCallback, useEffect, useId, useRef, useState, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { FieldLabel } from '@/components/atlas/FieldLabel';
import { useFieldHelp } from '@/components/atlas/FieldTooltip';
import { FilePreview, etiquetaDeTipo, iconoDeArchivo, tamanoLegible, tipoDeVista } from '@/components/atlas/FilePreview';
import { Icon } from '@/components/atlas/Icon';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';

interface FileDropFieldProps {
  label: string;
  /** Nombre del `<input type="file">`: con él, el archivo viaja en el `FormData` del formulario. */
  name?: string | undefined;
  /** Qué adjuntar y por qué importa: se abre al pasar por el ⓘ o al enfocar la zona. */
  tooltip?: string | undefined;
  /** Texto corto SIEMPRE visible bajo la zona. */
  hint?: string | undefined;
  /** Tipos admitidos, con la sintaxis de `accept`: `application/pdf,image/png`, `image/*`, `.xlsx`. */
  accept?: string | undefined;
  /** Peso máximo por archivo, en bytes. Sin él no se comprueba. */
  maxBytes?: number | undefined;
  multiple?: boolean | undefined;
  required?: boolean | undefined;
  /** Sólo el asterisco, sin `required` nativo (campos en pestañas ocultas). */
  softRequired?: boolean | undefined;
  disabled?: boolean | undefined;
  /**
   * Algo está pasando con los archivos elegidos («Subiendo el archivo…»). Se pinta en cada ficha,
   * con un indicador, y mientras dura no se puede cambiar ni quitar nada.
   */
  status?: string | undefined;
  className?: string | undefined;
  /** El `<input type="file">` real, para las pantallas que leen `ref.current.files` al enviar. */
  inputRef?: Ref<HTMLInputElement> | undefined;
  /** Controlado: los archivos que se enseñan. Si falta, el campo lleva los suyos. */
  files?: File[] | undefined;
  /** Se llama con la lista ya validada cada vez que cambia (elegir, soltar, cambiar, quitar). */
  onFilesChange?: ((files: File[]) => void) | undefined;
  /** Va al `<input>` real: los E2E hacen `setInputFiles` sobre él. */
  'data-testid'?: string | undefined;
}

/** «PDF, JPEG o PNG» a partir del `accept`, para no repetir a mano lo que ya se declaró. */
function describirTipos(accept: string | undefined): string {
  if (!accept) return '';
  const nombres: string[] = [];
  for (const bruto of accept.split(',')) {
    const token = bruto.trim().toLowerCase();
    if (!token) continue;
    const nombre =
      token === 'image/*' ? 'imágenes'
        : token.startsWith('.') ? etiquetaDeTipo(undefined, `x${token}`)
          : etiquetaDeTipo(token);
    if (!nombres.includes(nombre)) nombres.push(nombre);
  }
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}`;
}

/**
 * ¿El archivo cumple el `accept`? El navegador sólo lo aplica al selector: un archivo SOLTADO
 * llega sin filtrar, así que hay que comprobarlo aquí. Se mira también la extensión porque
 * Windows entrega un CSV como `application/vnd.ms-excel` y algunos equipos, sin tipo alguno.
 */
function admitido(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const tipo = file.type.toLowerCase();
  const nombre = file.name.toLowerCase();
  return accept.split(',').some((bruto) => {
    const token = bruto.trim().toLowerCase();
    if (!token) return false;
    if (token.startsWith('.')) return nombre.endsWith(token);
    if (token.endsWith('/*')) return tipo.startsWith(token.slice(0, -1));
    return tipo === token;
  });
}

const mismoArchivo = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function asignarRef<T>(ref: Ref<T> | undefined, valor: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(valor);
  else (ref as { current: T | null }).current = valor;
}

/**
 * El campo de archivo del ERP: se arrastra el archivo o se elige, y se VE antes de guardar.
 *
 * Sustituye al `<input type="file">` nativo en todo el ERP. El nativo se pintaba en el idioma del
 * navegador («Seleccionar archivo · Ningún archivo seleccionado»), no admitía soltar el archivo y,
 * una vez elegido, sólo enseñaba el nombre: adjuntar el borrador en vez del contrato firmado no se
 * notaba hasta abrirlo desde la fila, cuando el registro ya estaba creado.
 *
 * Por dentro sigue habiendo un `<input type="file">` REAL, visualmente oculto, con su `name`, su
 * `<label>` y su `ref`. Así nada cambia para quien lo usa: el archivo viaja en el `FormData` del
 * formulario como antes, `getByLabel(...).setInputFiles(...)` sigue funcionando y las pantallas
 * que leen `ref.current.files` al enviar no se enteran. Lo soltado se copia a ese input con un
 * `DataTransfer`, que es la única forma de asignarle archivos desde el código.
 *
 * La zona es un `<button>`: se enfoca con Tab y se abre con Enter o Espacio sin código extra. Su
 * nombre accesible es su propio texto, no la etiqueta del campo, para que `getByLabel('Documento')`
 * siga encontrando un único control —el input—; la etiqueta le llega por `aria-describedby`.
 */
export function FileDropField(props: FileDropFieldProps) {
  const id = useId();
  const help = useFieldHelp(props.tooltip);
  const input = useRef<HTMLInputElement | null>(null);
  /** Índice del archivo que se está cambiando con el selector; `null` = se agrega o se elige. */
  const reemplazo = useRef<number | null>(null);
  const [propios, setPropios] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);

  const controlado = props.files !== undefined;
  const archivos = controlado ? props.files ?? [] : propios;
  const bloqueado = Boolean(props.disabled || props.status);
  const tipos = describirTipos(props.accept);
  const detalleZona = [tipos, props.maxBytes ? `hasta ${tamanoLegible(props.maxBytes)}` : ''].filter(Boolean).join(' · ');

  /** Deja en el `<input>` real exactamente estos archivos, para que el `FormData` los lleve. */
  const sincronizar = useCallback((lista: File[]) => {
    const control = input.current;
    if (!control) return;
    const actuales = Array.from(control.files ?? []);
    if (actuales.length === lista.length && actuales.every((file, indice) => file === lista[indice])) return;
    try {
      const transferencia = new DataTransfer();
      lista.forEach((file) => transferencia.items.add(file));
      control.files = transferencia.files;
    } catch {
      // Sin `DataTransfer` construible (navegadores muy viejos) sólo se puede vaciar.
      if (!lista.length) control.value = '';
    }
  }, []);

  // Controlado: cuando la pantalla vacía la lista (tras subir), el input real se vacía con ella.
  useEffect(() => {
    if (controlado) sincronizar(props.files ?? []);
  }, [controlado, props.files, sincronizar]);

  /*
   * Un «Descartar»/«Cancelar» de tipo reset vacía el input real, pero no esta lista: sin escuchar
   * el `reset` del formulario la ficha seguiría enseñando un archivo que ya no se va a enviar.
   */
  useEffect(() => {
    const formulario = input.current?.form;
    if (!formulario) return undefined;
    const alReiniciar = () => {
      setPropios([]);
      setError(null);
      props.onFilesChange?.([]);
    };
    formulario.addEventListener('reset', alReiniciar);
    return () => formulario.removeEventListener('reset', alReiniciar);
  }, [props.onFilesChange]); // eslint-disable-line react-hooks/exhaustive-deps

  function aplicar(lista: File[]) {
    sincronizar(lista);
    if (!controlado) setPropios(lista);
    props.onFilesChange?.(lista);
  }

  /** Valida lo elegido o soltado y lo combina con lo que ya había. */
  function recibir(entrantes: File[]) {
    if (bloqueado || !entrantes.length) {
      // El selector cancelado entrega una lista vacía: se conserva lo que ya estaba elegido.
      sincronizar(archivos);
      return;
    }
    const problemas: string[] = [];
    const validos = entrantes.filter((file) => {
      if (!admitido(file, props.accept)) {
        problemas.push(`«${file.name}» no es un tipo admitido${tipos ? `: se aceptan ${tipos}` : ''}.`);
        return false;
      }
      if (props.maxBytes && file.size > props.maxBytes) {
        problemas.push(`«${file.name}» pesa ${tamanoLegible(file.size)}; el máximo es ${tamanoLegible(props.maxBytes)}.`);
        return false;
      }
      return true;
    });
    if (!props.multiple && entrantes.length > 1 && validos.length) {
      problemas.push(`Aquí va un solo archivo: se tomó «${validos[0]!.name}».`);
    }
    setError(problemas.length ? problemas.join(' ') : null);
    const indice = reemplazo.current;
    reemplazo.current = null;
    if (!validos.length) {
      sincronizar(archivos);
      return;
    }
    if (!props.multiple) {
      aplicar([validos[0]!]);
      return;
    }
    if (indice !== null && archivos[indice]) {
      const siguiente = [...archivos];
      siguiente.splice(indice, 1, validos[0]!);
      aplicar(siguiente);
      return;
    }
    aplicar([...archivos, ...validos.filter((nuevo) => !archivos.some((viejo) => mismoArchivo(viejo, nuevo)))]);
  }

  function abrirSelector(indice: number | null = null) {
    if (bloqueado) return;
    reemplazo.current = indice;
    input.current?.click();
  }

  function quitar(indice: number) {
    setError(null);
    aplicar(archivos.filter((_, posicion) => posicion !== indice));
  }

  const eventosDeArrastre = {
    onDragEnter: (event: React.DragEvent) => {
      if (bloqueado || !event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      setEncima(true);
    },
    onDragOver: (event: React.DragEvent) => {
      if (bloqueado || !event.dataTransfer.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setEncima(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      // Pasar de la zona a un hijo suyo también dispara `dragleave`: sólo cuenta salir de verdad.
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setEncima(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (bloqueado) return;
      event.preventDefault();
      setEncima(false);
      recibir(Array.from(event.dataTransfer.files));
    },
  };

  const pistaId = `${id}-pista`;
  const errorId = `${id}-error`;
  const etiquetaId = `${id}-etiqueta`;
  const describe = [etiquetaId, help.describedById, props.hint ? pistaId : null, error ? errorId : null].filter(Boolean).join(' ');
  const hayArchivos = archivos.length > 0;
  const zonaVisible = !hayArchivos || props.multiple;

  return (
    <div className={cn('block min-w-0', props.className)}>
      <FieldLabel
        htmlFor={id}
        id={etiquetaId}
        label={props.label}
        required={props.required || props.softRequired}
        tooltip={props.tooltip}
        describedById={help.describedById}
        controlFocused={help.focused}
      />
      <input
        ref={(nodo) => { input.current = nodo; asignarRef(props.inputRef, nodo); }}
        id={id}
        name={props.name}
        type="file"
        accept={props.accept}
        multiple={props.multiple}
        required={props.required}
        disabled={props.disabled}
        tabIndex={-1}
        className="sr-only"
        data-testid={props['data-testid']}
        onChange={(event) => recibir(Array.from(event.target.files ?? []))}
      />

      <div {...eventosDeArrastre} className={cn('space-y-2 rounded-lg transition', encima && hayArchivos && !props.multiple && 'ring-4 ring-primary/15')}>
        {hayArchivos ? (
          <ul className="space-y-2" aria-label="Archivos elegidos">
            {archivos.map((file, indice) => (
              <FichaDeArchivo
                key={`${file.name}-${file.size}-${file.lastModified}-${indice}`}
                file={file}
                status={props.status}
                bloqueado={bloqueado}
                onCambiar={() => abrirSelector(props.multiple ? indice : null)}
                onQuitar={() => quitar(indice)}
              />
            ))}
          </ul>
        ) : null}

        {zonaVisible ? (
          <button
            type="button"
            disabled={bloqueado}
            aria-describedby={describe}
            onClick={() => abrirSelector()}
            onFocus={help.onFocus}
            onBlur={help.onBlur}
            data-testid={props['data-testid'] ? `${props['data-testid']}-zona` : undefined}
            className={cn(
              'group grid w-full place-items-center rounded-lg border-2 border-dashed px-4 text-center transition',
              hayArchivos ? 'min-h-[64px] py-3' : 'min-h-[112px] py-5',
              encima ? 'border-[#006a61] bg-primary-wash ring-4 ring-primary/15' : error ? 'border-red-300 bg-red-50/40' : 'border-slate-300 bg-slate-50',
              'hover:border-[#006a61] hover:bg-primary-wash focus-visible:border-[#006a61] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-300 disabled:hover:bg-slate-50',
            )}
          >
            <span className={cn('flex items-center gap-3', hayArchivos ? 'flex-row' : 'flex-col gap-2')}>
              <span className={cn('grid place-items-center rounded-full bg-white text-[#006a61] shadow-sm ring-1 ring-slate-200', hayArchivos ? 'h-8 w-8' : 'h-10 w-10')}>
                <Icon name={encima ? 'file_download' : 'cloud_upload'} className={hayArchivos ? 'text-[18px]' : 'text-[22px]'} />
              </span>
              <span className={hayArchivos ? 'text-left' : ''}>
                <span className="block text-xs font-bold text-slate-800">
                  {encima
                    ? 'Suelta para adjuntarlo'
                    : hayArchivos
                      ? 'Arrastra otro archivo aquí o elige más'
                      : props.multiple
                        ? 'Arrastra los archivos aquí o elige uno o varios'
                        : 'Arrastra el archivo aquí o elige uno'}
                </span>
                {detalleZona ? <span className="mt-0.5 block text-[11px] text-slate-500">{detalleZona}</span> : null}
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1 text-[11px] font-semibold text-red-700">
          <Icon name="error" className="text-[15px]" />
          <span>{error}</span>
        </p>
      ) : null}
      {props.hint ? <span id={pistaId} className="mt-1 block text-[11px] text-slate-500">{props.hint}</span> : null}
    </div>
  );
}

interface FichaDeArchivoProps {
  file: File;
  status?: string | undefined;
  bloqueado: boolean;
  onCambiar: () => void;
  onQuitar: () => void;
}

/**
 * Un archivo elegido: su vista previa y, debajo, nombre, peso y tipo con «Cambiar» y «Quitar».
 *
 * La URL local se crea al montar la ficha y se libera al desmontarla: cada `createObjectURL`
 * retiene el archivo entero en memoria hasta que se revoca.
 */
function FichaDeArchivo({ file, status, bloqueado, onCambiar, onQuitar }: FichaDeArchivoProps) {
  const vista = tipoDeVista(file.type, file.name);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (vista === 'otro') return undefined;
    const creada = URL.createObjectURL(file);
    setUrl(creada);
    return () => {
      URL.revokeObjectURL(creada);
      setUrl(null);
    };
  }, [file, vista]);

  return (
    <li className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" data-testid="archivo-elegido">
      {vista !== 'otro' && url ? <FilePreview url={url} mimeType={file.type} nombre={file.name} /> : null}
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2', vista !== 'otro' && 'border-t border-slate-200')}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
          <Icon name={iconoDeArchivo(file.type, file.name)} className="text-[20px]" />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-xs font-bold text-slate-800" title={file.name}>{file.name}</p>
          <p className="text-[11px] text-slate-500">
            {etiquetaDeTipo(file.type, file.name)} · {tamanoLegible(file.size)}
            {status ? ` · ${status}` : ''}
          </p>
        </div>
        {status ? (
          <LoadingSpinner label={status} className="text-slate-600" />
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onCambiar}
              disabled={bloqueado}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
              aria-label={`Cambiar ${file.name}`}
            >
              <Icon name="swap_horiz" className="text-[16px]" />
              Cambiar
            </button>
            <button
              type="button"
              onClick={onQuitar}
              disabled={bloqueado}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-bold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50"
              aria-label={`Quitar ${file.name}`}
            >
              <Icon name="close" className="text-[16px]" />
              Quitar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
