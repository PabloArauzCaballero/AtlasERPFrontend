/**
 * Tipos del motor de tutoriales.
 *
 * Dos piezas complementarias, y conviene no confundirlas:
 *
 * - La **guía de pantalla** (`ScreenGuide`) responde «¿qué estoy viendo aquí?».
 *   Se lee en un panel lateral, sin tocar nada, y existe para cada vista.
 * - El **recorrido interactivo** (`InteractiveTutorial`) responde «¿cómo hago
 *   esto?». Resalta elementos reales de la pantalla y, cuando el paso lo pide,
 *   espera a que la persona haga la acción de verdad.
 *
 * Ninguna de las dos vive dentro de un componente: son datos. Añadir una vista
 * nueva es añadir su ficha, no tocar el motor.
 */

/** Acción real que el paso espera del usuario antes de avanzar. */
export type RequiredAction = 'click' | 'input' | 'submit';

export interface InteractiveStep {
  id: string;
  /** Selector del elemento a resaltar. Preferir `[data-tutorial-id="..."]`. */
  target?: string;
  title: string;
  /** Explicación en lenguaje llano, para alguien que no conoce el sistema. */
  content: string;
  /** Aparte destacado: un atajo, una consecuencia o una buena práctica. */
  tip?: string;
  /**
   * Si se define, el paso NO avanza con «Siguiente»: espera a que el usuario
   * haga esa acción sobre el elemento resaltado. Es lo que separa un recorrido
   * guiado de una presentación con capturas.
   */
  requiredAction?: RequiredAction;
  /** El paso se salta si su target no existe (funciones no disponibles). */
  optional?: boolean;
  /**
   * Ruta en la que vive este paso. Si el usuario está en otra, el motor navega
   * antes de resaltar. Sólo hace falta en los pasos que CAMBIAN de pantalla:
   * los demás heredan la del anterior, así que un recorrido de una sola vista
   * la escribe una vez.
   */
  route?: string;
  /**
   * Desde aquí el recorrido SIGUE al usuario en lugar de llevarlo.
   *
   * Las fichas de detalle viven en rutas que dependen del registro que se abra
   * (`?id=…`): el motor no puede inventar ese identificador. Con esto se corta
   * la herencia de ruta y el paso se queda donde el usuario haya llegado, en vez
   * de devolverlo al listado en bucle.
   */
  dynamicRoute?: boolean;
}

export interface InteractiveTutorial {
  /** Identificador estable, p. ej. `crm-cuentas`. */
  id: string;
  title: string;
  /** Una frase: para qué sirve este flujo. */
  intro: string;
  /** Se sube cuando cambian los pasos, para volver a ofrecer el recorrido. */
  version: number;
  steps: readonly InteractiveStep[];
}

/** Agrupación del Centro de Tutoriales. Refleja los grupos del menú lateral. */
export type TutorialCategory = 'introduccion' | 'crm' | 'contabilidad' | 'ads' | 'control' | 'portal';

export const TUTORIAL_CATEGORY_LABELS: Readonly<Record<TutorialCategory, string>> = {
  introduccion: 'Introducción',
  crm: 'CRM B2B',
  contabilidad: 'Contabilidad',
  ads: 'Publicidad',
  control: 'Control y administración',
  portal: 'Portal del comercio',
};

/** Cuánto hay que saber ya para seguir el recorrido sin perderse. */
export type TutorialLevel = 'basico' | 'intermedio' | 'avanzado';

export const TUTORIAL_LEVEL_LABELS: Readonly<Record<TutorialLevel, string>> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

/**
 * Ficha de catálogo: lo que el Centro necesita para listar, filtrar y ordenar un
 * recorrido sin cargar sus pasos.
 *
 * Deliberadamente NO lleva roles. Quién ve un tutorial se deriva de su `route` y
 * de la audiencia de esa ruta; duplicar aquí la tabla de permisos crearía una
 * segunda fuente de verdad que se desincronizaría en silencio de la real.
 */
export interface TutorialMeta {
  id: string;
  category: TutorialCategory;
  level: TutorialLevel;
  /** Ruta que enseña el recorrido. De ella se deriva quién puede verlo. */
  route?: string;
  estimatedMinutes: number;
  /** Ids de recorridos que conviene haber hecho antes. */
  prerequisites?: readonly string[];
  /** Se ofrece de entrada a quien nunca ha usado el ERP. */
  recommended?: boolean;
  /** Recorrido troncal: quien no lo ha hecho no entiende el resto. */
  essential?: boolean;
}

/** Ficha + definición, que es lo que consume el Centro. */
export interface TutorialListing extends TutorialMeta {
  title: string;
  intro: string;
  version: number;
  stepCount: number;
}

/* ------------------------------------------------------ guía de pantalla */

export interface GuideSection {
  title: string;
  body: string;
  /** Aparte destacado: la trampa, el atajo o la consecuencia. */
  tip?: string;
}

/**
 * «¿Qué estoy viendo aquí?» de una vista concreta.
 *
 * Es lo primero que abre alguien que llega a una pantalla y no la reconoce, así
 * que responde en este orden: qué es, para qué sirve, qué se hace, qué NO hace y
 * qué mirar cuando algo sale mal.
 */
export interface ScreenGuide {
  /** Antetítulo: el módulo al que pertenece la vista. */
  eyebrow: string;
  title: string;
  /** Una frase, sin jerga: qué es esta pantalla. */
  intro: string;
  sections: readonly GuideSection[];
  /**
   * Endpoint o módulo del backend detrás de la vista. Se muestra plegado: a un
   * usuario final no le dice nada, pero es lo primero que pregunta soporte.
   */
  backend?: string;
  /** Recorrido interactivo asociado, si lo hay. */
  tutorialId?: string;
}
