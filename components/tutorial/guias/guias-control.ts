import type { ScreenGuide } from '../tutorial-types';

/**
 * Guías del tablero principal y del módulo de Control y administración.
 *
 * Dos vistas de este grupo no leen datos de negocio sino del propio sistema
 * —el mapa del sitio y el centro de comando—, y hay dos que documentan una
 * carencia real del backend en lugar de simularla. Sus guías lo dicen con todas
 * las letras: una pantalla que promete lo que no puede cumplir se lee como una
 * avería, y hace perder más tiempo que una que avisa.
 */
export const GUIAS_CONTROL: Readonly<Record<string, ScreenGuide>> = {
  '/operaciones': {
    eyebrow: 'Panel de operaciones',
    title: 'Tablero ejecutivo',
    intro: 'La foto consolidada de la operación: comercial, financiera, publicitaria y de control.',
    sections: [
      {
        title: 'Por dónde empezar si acabas de entrar',
        body: 'Los indicadores de arriba resumen cada módulo; el menú de la izquierda los abre. Si no sabes qué es cada grupo del menú, el recorrido «Primeros pasos» los explica uno a uno.',
      },
      {
        title: 'Los cuatro grupos del menú',
        body: 'CRM lleva la relación con los comercios; Contabilidad, los libros; Publicidad, las campañas; Control, quién puede hacer qué y qué se hizo. Casi todo el trabajo diario ocurre en uno solo de ellos.',
      },
      {
        title: 'Los números vienen de los datos reales',
        body: 'Un cero es un cero real, no un dato que falta. Si el tablero no carga, aparece un aviso explícito en lugar de ceros silenciosos.',
      },
    ],
    tutorialId: 'primeros-pasos',
  },

  '/operaciones/auditoria/business-actions': {
    eyebrow: 'Control',
    title: 'Business Action Log',
    intro: 'El registro de quién hizo qué, cuándo y sobre qué registro.',
    sections: [
      {
        title: 'Es la memoria del sistema',
        body: 'Cada operación relevante —una aprobación, una activación, un cierre— deja una fila aquí. Es lo que se consulta cuando hay que reconstruir qué pasó.',
      },
      {
        title: 'No se edita ni se borra',
        body: 'Un registro de auditoría que se puede modificar no sirve para auditar. Sólo se consulta y se filtra.',
      },
      {
        title: 'Buscar por registro, no por persona',
        body: 'Lo habitual es partir del registro afectado —una cuenta, un documento— y ver todo lo que le pasó, en orden.',
      },
    ],
    tutorialId: 'control-auditoria',
  },

  '/operaciones/admin/seguridad': {
    eyebrow: 'Control',
    title: 'Usuarios internos',
    intro: 'Quién del personal de Atlas tiene acceso, con qué roles y en qué estado.',
    sections: [
      {
        title: 'Usuarios internos, no comercios',
        body: 'Aquí vive el personal de Atlas. Los usuarios de un comercio afiliado son otra población, se dan de alta en su onboarding y entran por otra puerta.',
      },
      {
        title: 'El rol es lo que decide los permisos',
        body: 'No se conceden permisos uno a uno: se asignan roles, y el rol trae su lista. El catálogo está en «Roles y permisos».',
      },
      {
        title: 'Desactivar en lugar de borrar',
        body: 'Un usuario con historial no puede desaparecer sin dejar acciones huérfanas en la auditoría. Lo que se retira es el acceso.',
      },
    ],
    tutorialId: 'control-usuarios',
  },

  '/operaciones/admin/roles': {
    eyebrow: 'Control',
    title: 'Roles y permisos',
    intro: 'El catálogo de roles del sistema y qué permite cada uno.',
    sections: [
      {
        title: 'Es de sólo lectura',
        body: 'Los roles y permisos se definen en la configuración del sistema, no desde aquí. Esta pantalla existe para consultarlos: antes de asignar un rol conviene saber qué abre.',
      },
      {
        title: 'Cómo leer la tabla',
        body: 'Cada fila es un permiso y cada columna un rol. Sirve para responder «¿quién puede hacer esto?» sin preguntar.',
      },
    ],
  },

  '/operaciones/admin/notificaciones': {
    eyebrow: 'Control',
    title: 'Campañas de notificación',
    intro: 'Avisos a clientes de la app con segmento, fecha de inicio, fecha de fin y cadencia, por bandeja, push y correo.',
    sections: [
      {
        title: 'Cómo se arma una campaña',
        body: 'Cuatro pasos: el contenido (título, mensaje, canales y a qué pantalla lleva tocarlo), la audiencia (condiciones sobre los datos del cliente o un segmento guardado), la programación (inicio, fin y cuántos avisos por minuto) y la revisión con el número real de personas. Guardar un borrador no envía nada.',
      },
      {
        title: 'A quién le llega',
        body: 'La bandeja de la app llega a toda la audiencia. El push sólo a quien tiene la app con los avisos activados, y el correo sólo a quien lo tiene verificado. Una campaña comercial descuenta a quien no aceptó promociones; los clientes bloqueados nunca reciben.',
      },
      {
        title: 'Después de programarla',
        body: 'Empieza sola a su hora. Se puede pausar, reanudar o cancelar con un motivo (se anulan los avisos que aún no salieron). El detalle muestra alcanzados, entregados, leídos y fallidos por canal, y permite enviarte una prueba antes de lanzarla.',
      },
    ],
  },

  '/operaciones/admin/busqueda-global': {
    eyebrow: 'Control',
    title: 'Centro de comando',
    intro: 'Buscador de pantallas, módulos y operaciones del ERP.',
    sections: [
      {
        title: 'Busca PANTALLAS, no datos',
        body: 'Sirve para llegar rápido a una vista cuyo nombre recuerdas a medias. No busca dentro de cuentas, facturas ni campañas.',
      },
      {
        title: 'Por qué no busca datos',
        body: 'Hoy no hay un buscador único que cruce todos los módulos. En vez de simular resultados, la pantalla hace lo que sí puede hacer con verdad: navegar.',
      },
      {
        title: 'Se abre desde la barra superior',
        body: 'El buscador de arriba lleva aquí. En móvil está tras la lupa.',
      },
    ],
  },

  '/operaciones/admin/mapa-sitio': {
    eyebrow: 'Control',
    title: 'Mapa del sistema',
    intro: 'El inventario de todas las pantallas del ERP y de qué puede hacer cada una.',
    sections: [
      {
        title: 'Qué significa cada estado',
        body: '«Completa» muestra lo guardado y deja trabajar con ello; «Sólo registrar» crea o cambia registros pero aún no lista los que ya existen; «En construcción» es una pantalla a la que todavía le falta la parte del sistema que la alimenta.',
      },
      {
        title: 'Para qué sirve en el día a día',
        body: 'Es la respuesta honesta a «¿esto ya funciona?». Antes de reportar algo como roto, mira si está declarado como brecha.',
      },
      {
        title: 'Se mantiene en el propio código',
        body: 'La lista vive junto a las rutas, así que no puede quedarse desfasada sin que se note al añadir una pantalla.',
      },
    ],
  },

  '/operaciones/cuenta': {
    eyebrow: 'Mi cuenta',
    title: 'Seguridad de tu acceso',
    intro: 'Cambia tu contraseña de acceso a la consola interna.',
    sections: [
      {
        title: 'Cambiar la contraseña cierra tus otras sesiones',
        body: 'Es deliberado: si la cambias porque sospechas que alguien la conoce, dejar viva la sesión de ese alguien no serviría de nada.',
      },
      {
        title: 'El acceso interno lleva segundo factor',
        body: 'Al entrar se envía un código a tu correo. Por eso importa que la dirección registrada sea una que leas de verdad.',
      },
    ],
  },
};
