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
        title: 'Los números vienen del backend',
        body: 'Un cero es un cero real, no un dato que falta. Si el tablero no carga, aparece un aviso explícito en lugar de ceros silenciosos.',
      },
    ],
    backend: 'Agregados de los módulos B2B, contabilidad, ads y auditoría',
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
    backend: 'GET /audit/business-actions',
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
    backend: 'GET/PATCH /internal/users, /internal/users/:id/roles',
    tutorialId: 'control-usuarios',
  },

  '/operaciones/admin/roles': {
    eyebrow: 'Control',
    title: 'Roles y permisos',
    intro: 'El catálogo de roles del sistema y qué permite cada uno.',
    sections: [
      {
        title: 'Es de sólo lectura',
        body: 'Los roles y permisos se definen en el backend, no desde aquí. Esta pantalla existe para consultarlos: antes de asignar un rol conviene saber qué abre.',
      },
      {
        title: 'Cómo leer la tabla',
        body: 'Cada fila es un permiso y cada columna un rol. Sirve para responder «¿quién puede hacer esto?» sin preguntar.',
      },
    ],
    backend: 'GET /internal/roles, /internal/permissions (sólo lectura)',
  },

  '/operaciones/admin/notificaciones': {
    eyebrow: 'Control',
    title: 'Centro de notificaciones',
    intro: 'La vista de alertas operativas por módulo y severidad.',
    sections: [
      {
        title: 'Aviso importante',
        body: 'Este backend todavía NO tiene módulo de notificaciones. La pantalla existe con su diseño definitivo, pero no hay una fuente real de alertas detrás: no la uses como si fuera un canal de aviso fiable.',
      },
      {
        title: 'Por qué se conserva',
        body: 'Documenta una carencia concreta en lugar de esconderla, y deja el hueco listo para cuando el módulo exista. Fingir alertas habría sido peor: se confiaría en algo que no vigila nada.',
      },
      {
        title: 'Mientras tanto',
        body: 'Lo que sí es real y sí se puede vigilar está en el Business Action Log y en el monitor de entrega.',
      },
    ],
    backend: 'Sin módulo de notificaciones en este backend',
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
        body: 'Este backend no expone un buscador federado sobre todos los módulos. En vez de simular resultados, la pantalla hace lo que sí puede hacer con verdad: navegar.',
      },
      {
        title: 'Se abre desde la barra superior',
        body: 'El buscador de arriba lleva aquí. En móvil está tras la lupa.',
      },
    ],
    backend: 'Registro local de vistas; sin endpoint de búsqueda federada',
  },

  '/operaciones/admin/mapa-sitio': {
    eyebrow: 'Control',
    title: 'Mapa del sistema',
    intro: 'El inventario de todas las vistas del ERP y su estado de integración con el backend.',
    sections: [
      {
        title: 'Qué significa cada estado',
        body: '«Integrada» lee y escribe contra el backend; «sólo acción» envía operaciones pero no tiene listado propio; «brecha backend» es una vista cuyo endpoint todavía no existe.',
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
    backend: 'Registro local de vistas y contratos',
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
    backend: 'POST /auth/password/change',
  },
};
