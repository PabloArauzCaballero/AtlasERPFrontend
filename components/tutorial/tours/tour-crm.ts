import type { InteractiveTutorial } from '../tutorial-types';

/**
 * Recorridos del embudo comercial.
 *
 * Enseñan el CAMINO, no las pantallas sueltas: el error más común de quien
 * empieza no es no encontrar un botón, es intentar contratar a un comercio que
 * nadie calificó. Por eso cada recorrido termina señalando el peldaño siguiente.
 */
export const TOURS_CRM: readonly InteractiveTutorial[] = [
  {
    id: 'crm-cuentas',
    title: 'Registrar y calificar una cuenta B2B',
    intro: 'El primer peldaño del embudo: dar de alta una empresa y decidir si encaja.',
    version: 1,
    steps: [
      {
        id: 'directorio',
        route: '/operaciones/crm/cuentas',
        target: '[data-tutorial-id="resource-table"]',
        title: 'Este es el directorio de empresas',
        content:
          'Cada fila es una empresa con la que Atlas tiene o quiere tener relación. Se registra una vez y sobrevive a todos sus contratos, facturas y campañas.',
      },
      {
        id: 'buscar-antes',
        target: '[data-tutorial-id="directory-search"]',
        title: 'Antes de crear, busca',
        content:
          'Escribe el NIT o el nombre de la empresa. Un duplicado parte en dos todo lo que cuelgue de esa cuenta, y eso se descubre meses después, cuando ya no cuadra ningún informe.',
        requiredAction: 'input',
        tip: 'Buscar por NIT es más fiable que por nombre: los nombres se escriben de muchas maneras.',
      },
      {
        id: 'crear',
        target: '[data-tutorial-id="directory-create"]',
        title: 'Si no existe, se registra',
        content:
          'Este botón abre el alta. Sólo son obligatorios los campos con asterisco; el resto se completa después desde la ficha.',
        optional: true,
      },
      {
        id: 'formulario',
        route: '/operaciones/crm/cuentas/crear',
        target: '[data-tutorial-id="action-form"]',
        title: 'Identidad, clasificación y contacto',
        content:
          'Razón social y NIT tal y como figuran en el documento: acabarán en contratos y facturas. El volumen esperado es orientativo y se puede corregir siempre.',
      },
      {
        id: 'guardar',
        target: '[data-tutorial-id="action-submit"]',
        title: 'Al guardar, la cuenta nace como lead',
        content:
          'No está contratada ni activa. Es el punto de partida: lo siguiente es calificarla, y hasta que eso ocurra no se puede abrir una oportunidad.',
      },
      {
        id: 'calificar',
        route: '/operaciones/crm/cuentas/calificar',
        target: '[data-tutorial-id="action-form"]',
        title: 'Calificar es decidir por escrito',
        content:
          'Aquí se registra si la empresa encaja como cliente y por qué. La justificación es lo que revisará control interno dentro de seis meses, cuando nadie recuerde la conversación.',
        tip: 'Si la calificación es favorable, el mismo formulario puede dejar la oportunidad abierta en el pipeline.',
      },
    ],
  },

  {
    id: 'crm-pipeline',
    title: 'Mover una oportunidad por el embudo',
    intro: 'Cómo se refleja el avance de una negociación y por qué importa mantenerlo al día.',
    version: 1,
    steps: [
      {
        id: 'tablero',
        route: '/operaciones/crm/oportunidades',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'El pipeline es el embudo',
        content:
          'Cada tarjeta es un trato abierto. Una misma empresa puede tener varios a la vez —líneas distintas, una renovación—, y por eso las oportunidades viven separadas de la cuenta.',
      },
      {
        id: 'etapas',
        target: '[data-tutorial-id="kanban-board"]',
        title: 'Las columnas son las etapas',
        content:
          'Cambiar una tarjeta de columna escribe en el servidor de verdad y queda registrado con tu nombre. Si la operación falla, la tarjeta vuelve sola a su sitio.',
        optional: true,
      },
      {
        id: 'consecuencia',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'Dejarlo desactualizado bloquea lo siguiente',
        content:
          'Una propuesta se emite contra una oportunidad, y un contrato contra una propuesta aceptada. Si el tablero no refleja la realidad, el paso siguiente se niega a avanzar y parece un fallo del sistema.',
      },
    ],
  },

  {
    id: 'crm-onboarding',
    title: 'Del contrato a un comercio operando',
    intro: 'Los controles que separan un contrato firmado de un comercio que ya puede vender.',
    version: 1,
    steps: [
      {
        id: 'caso',
        route: '/operaciones/crm/onboarding',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'El onboarding es un caso, no un formulario',
        content:
          'Se abre, avanza por partes y lo tocan varias áreas. Por eso su estado vive en el servidor y no en la cabeza de quien lo lleva: cualquiera puede retomarlo.',
      },
      {
        id: 'requisitos',
        target: '[data-tutorial-id="onboarding-checklist"]',
        title: 'Cada requisito bloquea la activación',
        content:
          'Legales, operativos y técnicos. Mientras quede uno pendiente el comercio no se activa, y eso es deliberado: activar sin los papeles es justo el riesgo que este caso existe para impedir.',
        optional: true,
      },
      {
        id: 'activacion',
        route: '/operaciones/crm/activacion-comercio',
        target: '[data-tutorial-id="workspace-header"]',
        title: 'La activación es el último control',
        content:
          'Al activar, el comercio empieza a poder originar operaciones, sus usuarios entran al portal y empieza a facturarse. Deja de ser un expediente y pasa a ser un negocio en marcha.',
        tip: 'Revertir una activación afecta a operaciones vivas. Comprueba antes; después, la corrección es otro caso.',
      },
    ],
  },
];
