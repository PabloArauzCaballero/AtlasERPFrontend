import type { Config } from 'tailwindcss';

/**
 * El lenguaje visual de ATLAS, traído desde el motor de decisión.
 *
 * Este portal pinta con clases crudas de Tailwind —unas cuatrocientas `slate-*` repartidas por los
 * componentes— y no con tokens semánticos. Cambiar el aspecto tocando cada una habría sido un
 * barrido de cuatrocientos sitios con cuatrocientas oportunidades de dejar uno atrás.
 *
 * En vez de eso se REDEFINE la rampa: `slate` deja de ser la de Tailwind y pasa a ser la escala
 * neutra del motor. Cada `text-slate-700` que ya existía queda pintado con el gris de ATLAS sin
 * que nadie edite el componente, y el que se escriba mañana también.
 *
 * Los valores no son estéticos: vienen de `AtlasDecisionEngineFrontend/src/styles/parts/theme.css`,
 * donde `theme-contrast.test.ts` los mide contra TODAS las superficies del sistema y falla si
 * alguno baja de 4,5:1. Aclarar uno aquí rompe esa garantía en silencio.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
         * La escala neutra del motor, mapeada a los peldaños que este portal ya usa.
         * Los extremos y los pasos intermedios salen de sus tokens: `--canvas`, `--line`,
         * `--line-strong`, `--faint`, `--muted`, `--text`, `--ink`, `--ink-strong`.
         */
        slate: {
          50: '#fafafa', // --surface-sunken
          100: '#f5f5f7', // --canvas
          200: '#e4e4e7', // --line
          300: '#c9c9cf', // --line-strong
          400: '#9a9aa3',
          500: '#6b6b75', // --faint  (4,63:1 en la peor superficie)
          600: '#5a5a63', // --muted
          700: '#38383d', // --text
          800: '#26262a',
          900: '#1d1d1f', // --ink
          950: '#0b0b0c', // --ink-strong
        },

        background: '#f5f5f7', // --canvas
        surface: '#ffffff',
        'surface-muted': '#fafafa', // --surface-sunken
        'surface-container': '#f0f0f3', // --surface-hover
        'border-subtle': '#e4e4e7', // --line

        /*
         * El acento deja de ser el azul marino `#031636` y pasa al verde azulado del motor.
         * Es deliberadamente profundo y poco saturado: en este sistema el color es SEÑAL, y un
         * acento que grita compite con los estados que sí tienen algo que decir.
         */
        primary: '#006a61', // --accent
        'primary-container': '#00544d', // --accent-strong
        'primary-soft': '#d9ebe8', // --accent-soft
        'primary-wash': '#f0f8f7', // --accent-wash
        'on-primary': '#ffffff',

        'on-surface': '#1d1d1f', // --ink
        'on-surface-variant': '#5a5a63', // --muted
        outline: '#6b6b75', // --faint

        // Semánticos con su lavado casi blanco: un aviso destaca por su icono y su letra, no
        // pintando un tercio de la pantalla de color.
        success: '#0f7b52',
        'success-wash': '#f0f9f4',
        warning: '#a34a05',
        'warning-wash': '#fdf6ec',
        danger: '#b42318',
        'danger-wash': '#fdf3f2',

        finance: '#006a61',
        legal: '#6b3fa0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      /*
       * A más superficie, más radio: un panel va a `lg`, una tarjeta a `md`, un control a `sm`.
       * Es la escala del motor, y existe porque este portal llegó a tener paneles de 4 px con
       * tarjetas de 8 dentro.
       */
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
