/**
 * Tema claro / oscuro / sistema.
 *
 * El tema activo es el atributo `data-theme` de `<html>`; `app/tema.css` define las variables de
 * los dos juegos y Tailwind las consume. La preferencia se guarda en `localStorage` y la aplica
 * `SCRIPT_DE_TEMA` antes del primer pintado (ver `app/layout.tsx`): si esperase a React, la página
 * se pintaría en claro y saltaría a oscuro.
 *
 * Nada de aquí usa `crypto`: en TEST el ERP se sirve por http plano y esa API no existe.
 */
export type PreferenciaDeTema = 'light' | 'dark' | 'system';
export type TemaEfectivo = 'light' | 'dark';

/** Clave nueva de este rediseño. No sustituye a ninguna clave que ya existiera. */
export const CLAVE_TEMA = 'cuotea-tema';

/**
 * Qué se aplica cuando la persona todavía no eligió.
 * FASE 6 lo cambia a 'system', cuando el tema oscuro ya está repasado pantalla por pantalla.
 */
export const PREFERENCIA_POR_DEFECTO: PreferenciaDeTema = 'light';

const VALIDAS: readonly string[] = ['light', 'dark', 'system'];

export function esPreferencia(valor: unknown): valor is PreferenciaDeTema {
  return typeof valor === 'string' && VALIDAS.includes(valor);
}

function sistemaPrefiereOscuro(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function leerPreferencia(): PreferenciaDeTema {
  if (typeof window === 'undefined') return PREFERENCIA_POR_DEFECTO;
  try {
    const guardada = window.localStorage.getItem(CLAVE_TEMA);
    return esPreferencia(guardada) ? guardada : PREFERENCIA_POR_DEFECTO;
  } catch {
    // Almacenamiento bloqueado (modo privado estricto): se sigue con el valor por defecto.
    return PREFERENCIA_POR_DEFECTO;
  }
}

export function temaEfectivo(preferencia: PreferenciaDeTema, prefiereOscuro: boolean = sistemaPrefiereOscuro()): TemaEfectivo {
  if (preferencia === 'system') return prefiereOscuro ? 'dark' : 'light';
  return preferencia;
}

/** Escribe el tema en `<html>`. No guarda nada. */
export function aplicarTema(preferencia: PreferenciaDeTema): TemaEfectivo {
  const tema = temaEfectivo(preferencia);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.setAttribute('data-theme-pref', preferencia);
  }
  return tema;
}

/** Guarda la elección y la aplica en el acto. */
export function guardarPreferencia(preferencia: PreferenciaDeTema): TemaEfectivo {
  try {
    window.localStorage.setItem(CLAVE_TEMA, preferencia);
  } catch {
    // Sin almacenamiento la elección vale para esta visita: se aplica igual.
  }
  return aplicarTema(preferencia);
}

/**
 * Lo mismo que `leerPreferencia` + `aplicarTema`, en ES5 y en una línea, para el `<script>` en línea
 * del `<head>`. Se arma con las mismas constantes para que no pueda divergir de la librería; lo
 * comprueba `tests/unit/tema.test.ts`.
 */
export const SCRIPT_DE_TEMA = `(function(){var r=document.documentElement;try{var p=localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});if(p!=='light'&&p!=='dark'&&p!=='system')p=${JSON.stringify(PREFERENCIA_POR_DEFECTO)};var o=p==='dark'||(p==='system'&&typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches);r.setAttribute('data-theme',o?'dark':'light');r.setAttribute('data-theme-pref',p);}catch(e){r.setAttribute('data-theme','light');}})();`;
