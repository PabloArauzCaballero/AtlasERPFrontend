/* eslint-disable @next/next/no-img-element -- son SVG propios servidos desde `public/marca`: el optimizador de imágenes no aporta nada a un vector */

/** Proporción del logo horizontal recortado: 530 × 150 (ver `public/marca/cuotea-logo-claro.svg`). */
const ANCHO_POR_ALTO = 530 / 150;

/**
 * Logo horizontal de Cuotea.
 *
 * El logo NO se recolorea (regla 7 de la identidad): para el tema oscuro hay OTRO archivo —el
 * provisional, con la palabra en claro— y aquí sólo se elige cuál se ve. Los dos van en el HTML y
 * el tema oculta uno, así no hay salto al hidratar.
 */
export function LogoCuotea({ alto = 28, className = '' }: Readonly<{ alto?: number; className?: string }>) {
  const ancho = Math.round(alto * ANCHO_POR_ALTO);
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`} data-testid="logo-cuotea">
      <img src="/marca/cuotea-logo-claro.svg" alt="Cuotea" width={ancho} height={alto} className="block dark:hidden" />
      <img src="/marca/cuotea-logo-oscuro.svg" alt="Cuotea" width={ancho} height={alto} className="hidden dark:block" />
    </span>
  );
}

/** Isotipo provisional: el cuadro amarillo con la «c». Es el mismo en los dos temas. */
export function IsotipoCuotea({ lado = 32, className = '' }: Readonly<{ lado?: number; className?: string }>) {
  return <img src="/marca/cuotea-isotipo.svg" alt="" aria-hidden="true" width={lado} height={lado} className={`shrink-0 ${className}`} />;
}
