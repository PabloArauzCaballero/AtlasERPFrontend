import type { Config } from 'tailwindcss';

/**
 * La identidad de Cuotea, servida a Tailwind desde `app/tema.css`.
 *
 * Este portal pinta con clases crudas de Tailwind —más de mil `slate-*` y unas doscientas de
 * estado— y no con tokens semánticos. Por eso no se edita cada clase: se REDEFINE la rampa. Cada
 * familia de Tailwind apunta a una variable CSS (`--c-neutral-700`, `--c-red-50`…) escrita como
 * tripleta RGB, y el tema oscuro sólo cambia el valor de la variable. `rgb(var(--c-x) / <alpha-value>)`
 * mantiene vivos los modificadores de opacidad (`bg-red-50/60`).
 *
 * Aquí NO hay ningún color: los valores viven en `app/tema.css` y los mide
 * `tests/unit/tema-contraste.test.ts`. Si falta un color, lo que falta es un token allí.
 */
const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const token = (nombre: string) => `rgb(var(--c-${nombre}) / <alpha-value>)`;
const rampa = (familia: string) => Object.fromEntries(PASOS.map((paso) => [paso, token(`${familia}-${paso}`)]));

const neutro = rampa('neutral');
const rojo = rampa('red');
const naranja = rampa('orange');
const verde = rampa('green');
const azul = rampa('azul');

/** Sin sombras: una capa flotante se separa con un aro de 1 px del borde de control. */
const ARO = '0 0 0 1px rgb(var(--c-border-strong))';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Familias de Tailwind → las cinco rampas de la identidad (ESPECIFICACION-COMUN §2).
        slate: neutro, gray: neutro, zinc: neutro, neutral: neutro, stone: neutro,
        red: rojo, rose: rojo,
        amber: naranja, orange: naranja, yellow: naranja,
        emerald: verde, green: verde, teal: verde,
        blue: azul, sky: azul, indigo: azul, cyan: azul, violet: azul, purple: azul,
        // `white` es la superficie: `bg-white` se oscurece en el tema oscuro y `text-white` sobre
        // una rampa invertida sigue contrastando.
        white: token('surface'),

        // Marca: el amarillo es SÓLO relleno de la acción principal, con tinta encima.
        brand: { DEFAULT: token('yellow'), strong: token('yellow-strong'), soft: token('yellow-soft') },
        'on-brand': token('on-yellow'),

        // Roles neutros.
        ink: { DEFAULT: token('ink'), muted: token('ink-muted') },
        canvas: token('canvas'),
        background: token('canvas'),
        surface: { DEFAULT: token('surface'), sunken: token('surface-sunken'), muted: token('surface-sunken') },
        border: { DEFAULT: token('border'), strong: token('border-strong') },
        'border-subtle': token('border'),
        'on-surface': token('ink'),
        'on-surface-variant': token('ink-muted'),
        outline: token('neutral-500'),

        // El antiguo acento verde azulado pasa a AZUL: texto interactivo, borde y foco.
        primary: { DEFAULT: token('blue'), container: token('azul-700'), soft: token('azul-100'), wash: token('blue-soft') },
        'on-primary': token('surface'),
        focus: token('focus'),

        // Estados, cada uno con su fondo suave (`-soft`; `-wash` es el nombre que ya usaba el portal).
        success: { DEFAULT: token('success'), soft: token('success-soft'), wash: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft'), wash: token('warning-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft'), wash: token('danger-soft') },

        // Velo detrás de diálogos y cajones. Lleva su alfa dentro: se usa como `bg-scrim`, sin `/NN`.
        scrim: 'rgb(var(--c-scrim) / var(--scrim-alpha))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      // Outfit se carga en 400, 500 y 600: nada pesa más de 600.
      fontWeight: { bold: '600', extrabold: '600', black: '600' },
      /*
       * Radios de consola (§4): 8 en controles y chips, 16 en tarjetas, paneles y tablas, 24 en
       * diálogos y cajones, píldora en estados. Se remapea la escala para no editar cada clase.
       */
      borderRadius: {
        none: '0',
        xs: '8px',
        sm: '8px',
        DEFAULT: '8px',
        md: '8px',
        lg: '16px',
        xl: '24px',
        '2xl': '24px',
        '3xl': '24px',
        full: '9999px',
      },
      // Sin sombras (§4). `lg`, `xl` y `2xl` son las que ya llevan las capas flotantes.
      boxShadow: { sm: 'none', DEFAULT: 'none', md: 'none', inner: 'none', lg: ARO, xl: ARO, '2xl': ARO },
    },
  },
  plugins: [],
};

export default config;
