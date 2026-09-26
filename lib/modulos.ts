/**
 * Módulos del ERP que hoy NO se enseñan.
 *
 * Ocultar no es borrar: las rutas siguen existiendo y responden si alguien las escribe o las tiene
 * en un marcador; lo que se retira es el camino para llegar —el menú y las tarjetas de la portada—
 * y los datos que ese módulo aportaba a pantallas de otros. Así volver a encenderlo es cambiar
 * `false` por `true` aquí, sin resucitar código de un commit viejo.
 *
 * Se hace desde UN sitio y no con `if` repartidos porque un módulo medio oculto es peor que
 * visible: el menú no lo ofrece pero la portada sigue enseñando su número, y quien mira no sabe si
 * lo que ve está vivo.
 */

/**
 * Publicidad (`/operaciones/ads/*`): anunciantes, campañas, moderación, delivery e inventario.
 *
 * Oculto el 2026-09-18 a petición de Pablo —«todo lo de publicidad ocultémoslo de momento»—
 * mientras el ERP se concentra en el crédito al comercio. Al encenderlo vuelven las diez entradas
 * del menú, la tarjeta «Operación publicitaria» del resumen ejecutivo y su panel de excepciones.
 */
export const PUBLICIDAD_VISIBLE = false;

/**
 * Notificaciones masivas (`/operaciones/admin/notificaciones`): campañas y segmentos a clientes de
 * la app.
 *
 * Oculto el 2026-09-26 a petición de Pablo —«quita notificaciones masivas del ERP»—. Al encenderlo
 * vuelven la entrada «Notificaciones masivas» de Control y la campana de la barra superior (y su
 * copia en el menú de perfil en móvil), que llevaban a la misma pantalla.
 */
export const NOTIFICACIONES_MASIVAS_VISIBLE = false;
