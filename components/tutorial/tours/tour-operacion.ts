import type { InteractiveTutorial } from '../tutorial-types';

/**
 * Recorridos de contabilidad, publicidad, control y portal del comercio.
 *
 * Los de contabilidad insisten en dos cosas que son la fuente de casi todas las
 * dudas del módulo: que se construye de abajo arriba —un desplegable vacío es una
 * dependencia sin crear, no un error— y que los asientos no se editan.
 */
export const TOURS_OPERACION: readonly InteractiveTutorial[] = [
  {
    id: 'contabilidad-cuentas-gl',
    title: 'Entender el plan de cuentas',
    intro: 'Qué es una cuenta GL y por qué exige lo que exige.',
    version: 1,
    steps: [
      {
        id: 'catalogo',
        route: '/operaciones/contabilidad/cuentas-gl',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Una cuenta GL es un cajón donde cae el dinero',
        content:
          'Caja, bancos, clientes, ingresos, impuestos. Todo movimiento contable pasa importe de un cajón a otro, y la suma de lo que entra y lo que sale tiene que dar cero.',
      },
      {
        id: 'clasificacion',
        target: '[data-tutorial-id="directory-filters"]',
        title: 'La clasificación decide dónde aparece',
        content:
          'Activo, pasivo, patrimonio, ingreso o gasto. Clasificar mal una cuenta no da ningún error: da un balance que no describe la realidad, y eso se descubre tarde.',
      },
      {
        id: 'dimensiones',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Las banderas de control se sufren al asentar',
        content:
          'Si una cuenta exige centro de costo o partner, nadie podrá registrar contra ella sin indicarlo. Cuando un asiento pida un campo que no esperabas, la explicación está en la ficha de la cuenta.',
      },
      {
        id: 'dependencia',
        target: '[data-tutorial-id="directory-create"]',
        title: 'Una cuenta vive dentro de una versión del plan',
        content:
          'Si al crearla el desplegable de versiones sale vacío, no es un fallo: falta versionar el plan de cuentas en «Impuestos y plan de cuentas». Este módulo se construye de abajo arriba.',
        optional: true,
      },
    ],
  },

  {
    id: 'contabilidad-documento',
    title: 'Registrar un asiento contable',
    intro: 'El hecho contable básico, y por qué no se puede corregir editándolo.',
    version: 1,
    steps: [
      {
        id: 'lineas',
        route: '/operaciones/contabilidad/documentos',
        target: '[data-tutorial-id="document-lines"]',
        title: 'Cada línea es un movimiento en una cuenta',
        content:
          'Eliges la cuenta GL, pones el importe al debe o al haber, y añades las dimensiones que esa cuenta exija. Un asiento normal tiene al menos dos líneas.',
      },
      {
        id: 'cuadre',
        target: '[data-tutorial-id="document-totals"]',
        title: 'Debe y haber tienen que cuadrar',
        content:
          'El pie te dice en todo momento cuánto falta. La pantalla no deja registrar un asiento descuadrado, y no es un capricho: uno solo rompe el balance entero.',
      },
      {
        id: 'periodo',
        target: '[data-tutorial-id="action-form"]',
        title: 'La fecha necesita un período abierto',
        content:
          'Si el sistema rechaza la fecha, mira «Períodos y libros»: el mes al que apuntas puede no existir todavía o estar ya cerrado.',
        optional: true,
      },
      {
        id: 'inmutable',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Lo registrado no se edita',
        content:
          'El historial de abajo es de sólo lectura. Un asiento equivocado se corrige con otro que lo revierte, porque un libro que se puede reescribir no prueba nada.',
        optional: true,
      },
    ],
  },

  {
    id: 'carga-masiva',
    title: 'Cargar muchos registros de una vez',
    intro: 'El patrón de importación que comparten cuentas, anunciantes y documentos.',
    version: 1,
    steps: [
      {
        id: 'plantilla',
        route: '/operaciones/crm/bulk-cuentas',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'Siempre se empieza por la plantilla',
        content:
          'Descarga el archivo de ejemplo y rellénalo. Las columnas tienen que ser exactamente las suyas: es lo que permite validar antes de enviar.',
      },
      {
        id: 'vista-previa',
        target: '[data-tutorial-id="bulk-preview"]',
        title: 'Nada se envía hasta que lo confirmas',
        content:
          'El archivo se lee en tu navegador y se muestra fila por fila con sus errores. Ese paso existe para que los veas ANTES de que toquen la base.',
        optional: true,
      },
      {
        id: 'corregir',
        target: '[data-tutorial-id="bulk-preview"]',
        title: 'Las filas en rojo se corrigen en el archivo',
        content:
          'No se editan aquí. Arreglar el origen y volver a cargarlo es más rápido, y te deja el archivo bueno para la próxima vez.',
        optional: true,
      },
      {
        id: 'transaccional',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'El lote entra entero o no entra',
        content:
          'Es una operación transaccional: no existe el estado intermedio en el que la mitad de los registros se crearon y la otra mitad se perdió.',
      },
    ],
  },

  {
    id: 'ads-campanas',
    title: 'Por qué una campaña no está entregando',
    intro: 'Los dos estados que se confunden y las dos causas que explican casi todo.',
    version: 1,
    steps: [
      {
        id: 'listado',
        route: '/operaciones/ads/campanas',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Dos estados distintos en la misma fila',
        content:
          'El estado operativo (activa, pausada) dice qué quiere el anunciante. El de aprobación (aprobada, rechazada) dice qué permite Atlas. Una campaña activa pero NO aprobada no entrega nada.',
      },
      {
        id: 'presupuesto',
        target: '[data-tutorial-id="directory-metrics"]',
        title: 'El presupuesto la frena sola',
        content:
          'Al agotarse el total la campaña deja de entregar aunque siga activa. Es la protección que impide gastar más de lo comprometido, y es la segunda causa más común.',
      },
      {
        id: 'moderacion',
        route: '/operaciones/ads/moderacion',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'Si el problema es la aprobación, se resuelve aquí',
        content:
          'La cola de moderación es el control previo. Un rechazo sin motivo escrito deja al anunciante sin saber qué corregir, así que el motivo es parte de la decisión.',
      },
    ],
  },

  {
    id: 'control-usuarios',
    title: 'Dar acceso a alguien del equipo',
    intro: 'Cómo se conceden permisos en Atlas, y por qué no se conceden de uno en uno.',
    version: 1,
    steps: [
      {
        id: 'directorio',
        route: '/operaciones/admin/seguridad',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Este es el personal de Atlas',
        content:
          'Sólo usuarios internos. Los usuarios de un comercio afiliado son otra población: se dan de alta en su onboarding y entran por otra puerta.',
      },
      {
        id: 'roles',
        route: '/operaciones/admin/roles',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Los permisos vienen del rol',
        content:
          'No se marca permiso a permiso: se asigna un rol y el rol trae su lista. Esta tabla es de sólo lectura y sirve para saber qué abre cada rol antes de asignarlo.',
      },
      {
        id: 'baja',
        route: '/operaciones/admin/seguridad',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Se desactiva, no se borra',
        content:
          'Un usuario con historial no puede desaparecer sin dejar acciones huérfanas en la auditoría. Lo que se retira es el acceso; lo que hizo se conserva.',
      },
    ],
  },

  {
    id: 'control-auditoria',
    title: 'Reconstruir qué pasó con un registro',
    intro: 'Cómo usar el registro de acciones cuando algo no cuadra.',
    version: 1,
    steps: [
      {
        id: 'ledger',
        route: '/operaciones/auditoria/business-actions',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Cada fila es una acción que alguien hizo',
        content:
          'Quién, qué, cuándo y sobre qué registro. Aprobaciones, activaciones, cierres: todo lo relevante deja rastro aquí.',
      },
      {
        id: 'buscar',
        target: '[data-tutorial-id="directory-search"]',
        title: 'Parte del registro, no de la persona',
        content:
          'Lo útil es buscar por el identificador del registro afectado y leer en orden todo lo que le pasó. Buscar por persona responde otra pregunta, y casi nunca es la que tienes.',
        requiredAction: 'input',
      },
      {
        id: 'inmutable',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'Aquí no se edita nada',
        content:
          'Un registro de auditoría que se puede modificar no sirve para auditar. Sólo se consulta y se filtra.',
      },
    ],
  },

  {
    id: 'portal-primeros-pasos',
    title: 'Tu portal, de un vistazo',
    intro: 'Qué puedes hacer como comercio y dónde está cada cosa.',
    version: 1,
    steps: [
      {
        id: 'menu',
        route: '/portal-comercio/planes',
        target: '[data-tutorial-id="portal-nav"]',
        title: 'Éstas son tus secciones',
        content:
          'Tu plan, tu facturación, tus campañas, tus sucursales y el registro de ventas a crédito. Nada de lo que veas aquí es de otro comercio.',
        tip: 'En el móvil el menú se abre con el botón de las tres rayas, arriba a la izquierda.',
      },
      {
        id: 'planes',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'El plan se activa al elegirlo',
        content:
          'No es una solicitud que alguien revisa después: al confirmar queda activo y cambia tu facturación del período. Si dependes de algo que el plan nuevo no incluye, dejarás de tenerlo.',
      },
      {
        id: 'ayuda',
        target: '[data-tutorial-id="screen-guide-button"]',
        title: 'Cada pantalla se explica sola',
        content:
          'Este botón, junto al título, abre la explicación de la pantalla en la que estés: qué es, qué puedes hacer y a quién avisar si algo no sale como esperabas.',
        requiredAction: 'click',
      },
    ],
  },
];
