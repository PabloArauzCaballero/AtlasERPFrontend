import type { InteractiveTutorial } from '../tutorial-types';

/**
 * Recorridos troncales: la orientación que necesita alguien que abre el ERP por
 * primera vez y no sabe ni dónde está el menú.
 *
 * Sólo apuntan a elementos del armazón —barra superior, menú lateral, cabecera de
 * pantalla—, que existen en todas las vistas. Es lo que permite lanzarlos desde
 * cualquier sitio sin que el foco se quede señalando el vacío.
 */
export const TOURS_INTRODUCCION: readonly InteractiveTutorial[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos en Atlas ERP',
    intro: 'Qué es cada parte de la pantalla y cómo llegar a lo que necesitas.',
    version: 1,
    steps: [
      {
        id: 'bienvenida',
        route: '/operaciones',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'Estás en el tablero',
        content:
          'Ésta es la pantalla de inicio de la consola interna. Resume lo que está pasando en los cuatro módulos del ERP para que sepas si hay algo que atender antes de entrar a ninguno.',
        tip: 'Puedes salir del recorrido en cualquier momento con la tecla Escape. Se guarda por dónde ibas.',
      },
      {
        id: 'menu',
        target: '[data-tutorial-id="sidebar-nav"]',
        title: 'El menú lateral son los cuatro módulos',
        content:
          'CRM lleva la relación con los comercios; Contabilidad, los libros; Publicidad, las campañas; Control, quién puede hacer qué y qué se hizo. Tu trabajo diario ocurrirá casi siempre dentro de uno solo.',
        tip: 'En una pantalla estrecha el menú se abre con el botón de las tres rayas, arriba a la izquierda.',
      },
      {
        id: 'ayuda-pantalla',
        target: '[data-tutorial-id="screen-guide-button"]',
        title: 'Éste es el botón que explica dónde estás',
        content:
          'Está junto al título de CADA pantalla. Abre un panel que responde qué es esa vista, qué se hace en ella y qué no, y dónde mirar si algo falla. Si te pierdes, es el primer sitio al que ir.',
        requiredAction: 'click',
      },
      {
        id: 'buscador',
        target: '[data-tutorial-id="topbar-search"]',
        title: 'El buscador encuentra pantallas',
        content:
          'Escribe parte del nombre de una vista y te lleva a ella. Busca pantallas del ERP, no datos: para encontrar una cuenta o una factura hay que ir a su módulo.',
        optional: true,
      },
      {
        id: 'perfil',
        target: '[data-tutorial-id="topbar-profile"]',
        title: 'Tu sesión',
        content:
          'Aquí ves con qué usuario y con qué roles has entrado —eso decide qué puedes hacer— y desde aquí cierras la sesión.',
      },
      {
        id: 'centro',
        route: '/operaciones/tutoriales',
        target: '[data-tutorial-id="tutorial-center"]',
        title: 'El Centro de Tutoriales',
        content:
          'Todos los recorridos disponibles, con tu avance. Puedes retomar uno a medias, repetir uno hecho y filtrar por módulo. Está también en el menú lateral, arriba del todo.',
      },
    ],
  },

  {
    id: 'usar-listados',
    title: 'Buscar, filtrar y abrir registros',
    intro: 'El patrón que se repite en casi todos los listados del ERP.',
    version: 1,
    steps: [
      {
        id: 'metricas',
        route: '/operaciones/crm/cuentas',
        target: '[data-tutorial-id="directory-metrics"]',
        title: 'Primero, el resumen',
        content:
          'Los indicadores de arriba cuentan lo que hay en el listado. Sirven para saber si el filtro que vas a aplicar tiene sentido antes de aplicarlo.',
      },
      {
        id: 'buscar',
        target: '[data-tutorial-id="directory-search"]',
        title: 'El buscador filtra la tabla',
        content:
          'Escribe aquí y la tabla se reduce a lo que coincide. No hace falta pulsar nada: busca solo, con una pequeña pausa para no consultar en cada tecla.',
        requiredAction: 'input',
      },
      {
        id: 'filtros',
        target: '[data-tutorial-id="directory-filters"]',
        title: 'Los desplegables acotan por estado',
        content:
          'Se combinan con el buscador. Si la tabla sale vacía, casi siempre es porque queda un filtro puesto de una consulta anterior.',
        tip: 'Vacía el buscador y pon todos los desplegables en «Todos» antes de concluir que falta un registro.',
      },
      {
        id: 'tabla',
        target: '[data-tutorial-id="resource-table"]',
        title: 'La tabla y sus acciones',
        content:
          'Cada fila es un registro. Al final de la fila están las acciones; el icono de ojo abre la ficha completa. En pantallas estrechas la tabla se desplaza de lado.',
      },
    ],
  },
];
