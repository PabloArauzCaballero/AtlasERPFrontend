/**
 * Volver a preguntar mientras una persona espera, sin martillar al servidor.
 *
 * En el mostrador el cliente está de pie delante de la caja: su solicitud tiene que aparecer sola,
 * no cuando alguien se acuerde de pulsar «Actualizar». Pero preguntar cada pocos segundos desde una
 * pestaña escondida, o con el servidor caído, sólo suma carga. Por eso:
 *
 * - pregunta cada `intervaloMs` (5–10 s) SÓLO mientras la pantalla está a la vista;
 * - al volver a la vista pregunta enseguida (lo que pasó mientras no mirabas es lo que importa);
 * - si falla, espera el doble cada vez, hasta `maxIntervaloMs`, y vuelve al ritmo normal al primer acierto;
 * - nunca hay dos preguntas a la vez; `detener()` lo apaga todo.
 *
 * No sabe nada de React ni del navegador: la visibilidad se la pasa quien lo usa (`document` en la
 * web, `AppState` en el teléfono), y así se prueba con relojes falsos.
 */
export interface OpcionesDeSondeo {
  consultar: () => Promise<unknown>;
  estaVisible: () => boolean;
  /** Avisa cuando cambia la visibilidad; devuelve cómo dejar de escuchar. */
  alCambiarVisibilidad: (avisar: () => void) => () => void;
  intervaloMs?: number;
  maxIntervaloMs?: number;
}

export interface Sondeo {
  detener: () => void;
  /** Pregunta ya (p. ej. tras una acción del usuario) y reinicia la cuenta. */
  ahora: () => void;
}

export const INTERVALO_SONDEO_MS = 7_000;
export const MAX_INTERVALO_SONDEO_MS = 60_000;

export function crearSondeo(opciones: OpcionesDeSondeo): Sondeo {
  const base = opciones.intervaloMs ?? INTERVALO_SONDEO_MS;
  const maximo = Math.max(opciones.maxIntervaloMs ?? MAX_INTERVALO_SONDEO_MS, base);
  let espera = base;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let enCurso = false;
  let vivo = true;

  const limpiar = () => {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
  };

  const programar = () => {
    limpiar();
    if (!vivo || !opciones.estaVisible()) return;
    temporizador = setTimeout(() => void preguntar(), espera);
  };

  async function preguntar(): Promise<void> {
    if (!vivo || enCurso || !opciones.estaVisible()) return;
    limpiar();
    enCurso = true;
    try {
      await opciones.consultar();
      espera = base;
    } catch {
      espera = Math.min(espera * 2, maximo);
    } finally {
      enCurso = false;
    }
    programar();
  }

  const dejarDeEscuchar = opciones.alCambiarVisibilidad(() => {
    if (!vivo) return;
    if (opciones.estaVisible()) void preguntar();
    else limpiar();
  });

  programar();

  return {
    detener: () => {
      vivo = false;
      limpiar();
      dejarDeEscuchar();
    },
    ahora: () => void preguntar(),
  };
}

/**
 * Qué llegó NUEVO entre dos lecturas de una cola. La primera lectura no avisa de nada: lo que ya
 * estaba al abrir la pantalla no es «nuevo», y sonar por eso enseña a ignorar el aviso.
 */
export function crearDetectorDeNuevos<T>(clave: (item: T) => string) {
  let vistos: Set<string> | null = null;
  return (items: readonly T[]): T[] => {
    const actuales = new Set(items.map(clave));
    const nuevos = vistos === null ? [] : items.filter((item) => !vistos!.has(clave(item)));
    vistos = actuales;
    return nuevos;
  };
}
