import type { InteractiveTutorial } from '../tutorial-types';

/**
 * Los recorridos que hay que hacer PRIMERO.
 *
 * Pedido de Pablo el 2026-09-14: «lo primerísimo que deben enseñar los tutoriales» es cómo se
 * registra un negocio desde cero, cómo se crea un usuario final y cómo se registra un hecho
 * contable. Cada uno atraviesa varias pantallas y termina diciendo qué sigue; las guías de cada
 * pantalla siguen existiendo para el detalle, pero éstos son el mapa.
 */
export const TOURS_NEGOCIO: readonly InteractiveTutorial[] = [
  {
    id: 'negocio-desde-cero',
    title: 'Registrar un negocio desde cero (hasta que opera)',
    intro:
      'La cadena completa: empresa → calificación → oportunidad → propuesta → contrato → onboarding con documentos → decisión del Motor → activación. Ocho pasos, y cada uno desbloquea el siguiente.',
    version: 1,
    steps: [
      {
        id: 'mapa',
        route: '/operaciones/crm/cuentas',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '1 · Todo empieza con la empresa',
        content:
          'Un negocio en Atlas es primero una CUENTA B2B: razón social, NIT, rubro y una persona de contacto. Sin cuenta no hay oportunidad, sin oportunidad no hay propuesta y sin propuesta aceptada no hay contrato ni onboarding. Este recorrido sigue ese orden.',
        tip: 'Antes de crear, busca por NIT: un duplicado parte el expediente en dos.',
      },
      {
        id: 'crear-empresa',
        route: '/operaciones/crm/cuentas/crear',
        target: '[data-tutorial-id="action-form"]',
        title: '2 · Registrar la empresa',
        content:
          'Sólo son obligatorios los campos con asterisco. OJO: la pestaña «Persona de contacto» también tiene uno (nombre completo); si falta, el botón te llevará a esa pestaña y te lo dirá. Al crear, la empresa entra como «lead» y se abre su ficha.',
      },
      {
        id: 'calificar',
        route: '/operaciones/crm/cuentas/calificar',
        target: '[data-tutorial-id="action-form"]',
        title: '3 · Calificar: ¿encaja como cliente?',
        content:
          'Aquí se decide por escrito si la empresa sirve como cliente y por qué. Una calificación favorable puede abrir directamente la OPORTUNIDAD en el pipeline; si no, se crea después desde Oportunidades.',
      },
      {
        id: 'oportunidad',
        route: '/operaciones/crm/oportunidades',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '4 · La oportunidad es la negociación',
        content:
          'Una oportunidad es «esta empresa, con este tipo de trato, por este volumen». Es lo que se elige al armar la propuesta: si no ves tu empresa en el desplegable de propuestas, es que le falta la oportunidad.',
      },
      {
        id: 'propuesta',
        route: '/operaciones/crm/propuestas',
        target: '[data-testid="tab-nueva"]',
        title: '5 · La propuesta: términos comerciales',
        content:
          'En «Nueva propuesta» eliges la oportunidad, le pones número y cargas los TÉRMINOS (MDR %, suscripción, cargo fijo…). Primero «Guardar propuesta» (queda DRAFT); luego «Enviar al cliente»; cuando el cliente acepta, se marca «Aceptada» desde la tabla. Una propuesta enviada ya no se edita: se hace otra.',
        requiredAction: 'click',
        optional: true,
      },
      {
        id: 'aprobaciones',
        route: '/operaciones/crm/aprobaciones',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '6 · Aprobaciones: sólo si hay excepción',
        content:
          'Si un término se sale de la política (por ejemplo un MDR por debajo del mínimo), la propuesta genera una solicitud de EXCEPCIÓN y no se puede enviar hasta que alguien con poder la apruebe aquí. Si no hay excepción, esta pantalla no interviene.',
      },
      {
        id: 'contrato',
        route: '/operaciones/crm/contratos',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '7 · El contrato nace de la propuesta ACEPTADA',
        content:
          '«Generar contrato» sólo ofrece propuestas aceptadas: hereda los términos y fija vigencia, ciclo de facturación y política de liquidación. Después se firma y activa desde la fila. El contrato es lo que factura y liquida; sin él no hay onboarding que completar.',
      },
      {
        id: 'onboarding',
        route: '/operaciones/crm/onboarding',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '8 · Onboarding: documentos, Motor y activación',
        content:
          'Con el contrato vigente se abre el CASO de onboarding: se suben los documentos del comercio (NIT, matrícula, representante), se crean sus usuarios (llegan por correo con contraseña temporal) y se pide la revisión KYB al MOTOR DE DECISIONES. Sólo con el veredicto APROBADO del Motor, el contrato vigente y sin requisitos pendientes aparece «Activar». Ahí el negocio empieza a operar.',
        tip: 'Si el Motor no responde, el caso se queda EN_VERIFICACION: nunca se aprueba solo.',
      },
    ],
  },

  {
    id: 'usuario-final-comercio',
    title: 'Crear un usuario final del comercio, paso a paso',
    intro:
      'Cómo una persona del negocio recibe su acceso al Portal del comercio: se pide desde el caso de onboarding, Atlas lo concede y le llega un correo con su contraseña temporal.',
    version: 1,
    steps: [
      {
        id: 'donde',
        route: '/operaciones/crm/onboarding',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '1 · Se crea desde el caso de onboarding',
        content:
          'Los usuarios del comercio no se inventan sueltos: pertenecen a un caso de onboarding (y por tanto a una cuenta con contrato). Abre el caso del negocio y busca la sección de usuarios.',
      },
      {
        id: 'pedir',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '2 · Nombre, correo y rol',
        content:
          'Se registra el nombre completo, el correo REAL de la persona y su rol en el comercio. El usuario nace INVITADO: el ERP encola la petición en Atlas, porque la identidad la concede el portal interno, no el ERP.',
        tip: 'El correo tiene que ser accesible: ahí llega la contraseña.',
      },
      {
        id: 'conceder',
        target: '[data-tutorial-id="crud-tabla"]',
        title: '3 · Atlas concede y avisa por correo',
        content:
          'En el Portal interno (Comercios › Usuarios) un operador aprueba la petición. En ese momento Atlas genera la contraseña temporal y la envía al correo de la persona («ATLAS — Tu cuenta fue creada»). El ERP reconcilia solo y el usuario pasa de INVITADO a ACTIVO.',
      },
      {
        id: 'entrar',
        route: '/login',
        target: '[data-tutorial-id="topbar-search"]',
        title: '4 · Primer ingreso',
        content:
          'La persona entra en «Comercio afiliado» con su correo y la contraseña temporal, y la cambia desde Mi cuenta. Si no le llegó el correo, un operador puede reenviarlo desde el Portal interno.',
        optional: true,
      },
    ],
  },
];
