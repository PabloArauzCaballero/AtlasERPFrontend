import type { ScreenGuide } from '../tutorial-types';

/**
 * Guías del módulo CRM B2B.
 *
 * El hilo que las une, y que conviene entender antes que cualquier pantalla
 * suelta: en Atlas un comercio no «se crea», se GRADÚA. Cuenta → calificación →
 * oportunidad → propuesta → aprobación → contrato → onboarding → activación. Cada
 * vista de aquí es un peldaño de esa escalera, y casi todas se niegan a funcionar
 * si el peldaño anterior no está hecho. Cuando algo «no deja avanzar», la
 * respuesta suele estar una pantalla más atrás, no en la que se está mirando.
 */
export const GUIAS_CRM: Readonly<Record<string, ScreenGuide>> = {
  '/operaciones/crm/cuentas': {
    eyebrow: 'CRM B2B',
    title: 'Cuentas B2B',
    intro: 'El directorio de todas las empresas con las que Atlas tiene o quiere tener relación comercial.',
    sections: [
      {
        title: 'Qué es una cuenta',
        body: 'Una cuenta es una EMPRESA, no una persona ni un trato. Se registra una vez y sobrevive a todos sus contratos, facturas y campañas. Si la misma empresa aparece dos veces, todo lo que cuelga de ella queda partido en dos y ningún informe cuadra.',
        tip: 'Antes de crear una cuenta, búscala por NIT en el buscador de arriba. Es más rápido que descubrir el duplicado tres meses después.',
      },
      {
        title: 'El estado del ciclo de vida manda',
        body: 'La columna de estado (lead, calificada, cliente…) no es una etiqueta descriptiva: decide qué se puede hacer con la cuenta. Una cuenta en «lead» no admite contrato, y una sin calificar no genera oportunidad.',
      },
      {
        title: 'Qué se hace aquí y qué no',
        body: 'Aquí se busca, se filtra y se abre la ficha de una cuenta, y se registra una nueva. Lo que le PASA a la cuenta —calificarla, proponerle algo, contratarla— ocurre en sus pantallas propias, a las que se llega desde la ficha.',
      },
      {
        title: 'Cuando la tabla sale vacía',
        body: 'Vacía significa «no hay cuentas que cumplan estos filtros», no «el sistema está roto». Limpia el buscador y los desplegables antes de dar por hecho que falta información.',
      },
    ],
    backend: 'GET /b2b/accounts',
    tutorialId: 'crm-cuentas',
  },

  '/operaciones/crm/cuentas/crear': {
    eyebrow: 'CRM B2B',
    title: 'Registrar cuenta B2B',
    intro: 'Da de alta una empresa nueva en el directorio comercial.',
    sections: [
      {
        title: 'Los campos con asterisco son los que el backend exige',
        body: 'El resto se puede completar después desde la ficha. Empezar con lo mínimo verificable es mejor que rellenar a ojo: lo que se escribe aquí acaba en contratos y facturas.',
      },
      {
        title: 'El NIT es la identidad',
        body: 'Es el campo por el que el sistema reconoce que dos registros son la misma empresa. Un NIT mal escrito no da error hoy; da un duplicado mañana.',
      },
      {
        title: 'Categoría y rubro salen de un catálogo',
        body: 'No se escriben. Son lo que agrupa la cartera —«cuántos comercios de retail tengo», «cuánto financio en farmacias»—, y un campo libre convierte esa pregunta en algo que nadie puede responder: «Retail», «retail» y «RETAIL» son tres grupos distintos para una base de datos.',
      },
      {
        title: 'El volumen esperado no es un compromiso',
        body: 'Sirve para priorizar y para dimensionar la propuesta. Se puede corregir en cualquier momento y no bloquea nada.',
      },
      {
        title: 'Al guardar',
        body: 'La cuenta nace en el estado inicial del ciclo de vida. No está contratada ni activa: es el punto de partida para calificarla.',
      },
    ],
    backend: 'POST /b2b/accounts',
  },

  '/operaciones/crm/cuentas/detalle': {
    eyebrow: 'CRM B2B',
    title: 'Ficha de la cuenta',
    intro: 'Todo lo que Atlas sabe de una empresa, reunido en una pantalla.',
    sections: [
      {
        title: 'Se llega con un identificador',
        body: 'Esta vista necesita saber QUÉ cuenta mostrar, y ese dato viaja en la dirección. Si llegas aquí sin abrirla desde el directorio, no habrá nada que enseñar.',
        tip: 'Vuelve a «Cuentas B2B» y usa el icono de ver detalle al final de la fila.',
      },
      {
        title: 'Las actividades son el historial',
        body: 'Llamadas, correos y visitas registradas contra la cuenta. Es lo que permite que otra persona retome la relación sin llamar a preguntar qué pasó.',
      },
      {
        title: 'Los adjuntos son evidencia',
        body: 'Los documentos que se suben aquí sostienen decisiones posteriores —una calificación, una excepción de precio—. Suben con el registro, no con la persona.',
      },
    ],
    backend: 'GET /b2b/accounts/:id',
  },

  '/operaciones/crm/cuentas/calificar': {
    eyebrow: 'CRM B2B',
    title: 'Calificar cuenta',
    intro: 'Deja por escrito si esta empresa encaja como cliente, y por qué.',
    sections: [
      {
        title: 'Calificar es decidir, no describir',
        body: 'La decisión que se registra aquí abre o cierra el resto del embudo: una cuenta no calificada no genera oportunidad, y sin oportunidad no hay propuesta ni contrato.',
      },
      {
        title: 'La justificación es lo que se audita',
        body: 'Meses después nadie recuerda por qué se aceptó o descartó una cuenta. El texto que escribas aquí es lo que quedará, y es lo que revisará control interno.',
      },
      {
        title: 'Puede crear la oportunidad por ti',
        body: 'Cuando la calificación es favorable, el mismo formulario deja la oportunidad abierta en el pipeline. Evita el paso manual y evita olvidarlo.',
      },
    ],
    backend: 'POST /b2b/accounts/:accountId/qualify',
  },

  '/operaciones/crm/bulk-cuentas': {
    eyebrow: 'CRM B2B',
    title: 'Carga masiva de cuentas',
    intro: 'Registra muchas empresas de una vez desde una plantilla, con revisión previa.',
    sections: [
      {
        title: 'Nada se envía hasta que lo confirmas',
        body: 'El archivo se lee en tu navegador y se muestra una vista previa fila por fila. Ese paso existe para que veas los errores ANTES de que toquen la base, no después.',
      },
      {
        title: 'Las filas en rojo no se corrigen aquí',
        body: 'Se corrigen en el archivo y se vuelve a cargar. Es más rápido y deja el archivo bueno, que es lo que querrás la próxima vez.',
      },
      {
        title: 'Es una operación transaccional',
        body: 'El lote entra entero o no entra. No te quedas con la mitad de las cuentas creadas y la otra mitad perdida.',
      },
    ],
    backend: 'POST /b2b/accounts/bulk',
    tutorialId: 'carga-masiva',
  },

  '/operaciones/crm/oportunidades': {
    eyebrow: 'CRM B2B',
    title: 'Pipeline de oportunidades',
    intro: 'El tablero del embudo: en qué etapa está cada negociación abierta.',
    sections: [
      {
        title: 'Una oportunidad es un trato, no una empresa',
        body: 'La misma cuenta puede tener varias oportunidades a la vez —líneas de negocio distintas, renovaciones—. Por eso viven separadas de la cuenta.',
      },
      {
        title: 'Mover la tarjeta cambia el estado de verdad',
        body: 'No es un tablero decorativo: cambiar de columna escribe en el backend y queda registrado con quién lo hizo. Si la operación falla, la tarjeta vuelve a su sitio.',
      },
      {
        title: 'La etapa condiciona lo que viene después',
        body: 'Una propuesta se emite contra una oportunidad, y un contrato contra una propuesta aceptada. Dejar el tablero desactualizado bloquea el paso siguiente.',
      },
    ],
    backend: 'POST/PATCH /b2b/opportunities',
    tutorialId: 'crm-pipeline',
  },

  '/operaciones/crm/propuestas': {
    eyebrow: 'CRM B2B',
    title: 'Propuestas comerciales',
    intro: 'Arma los términos económicos que se le ofrecen a un cliente y déjalos aprobados antes de enviarlos.',
    sections: [
      {
        title: 'Cada línea es un concepto cobrable',
        body: 'Tasa, monto fijo, mínimo mensual, periodicidad. Lo que se escriba aquí es lo que después factura el sistema: la propuesta no es un documento comercial suelto, es la fuente de los cobros.',
      },
      {
        title: 'Salirse de la tarifa estándar exige aprobación',
        body: 'Una excepción de pricing va a la cola de aprobaciones con su justificación. No es burocracia: es lo que permite saber quién autorizó un descuento y con qué argumento.',
      },
      {
        title: 'Aceptada, no enviada',
        body: 'El contrato se genera desde una propuesta ACEPTADA. Enviarla al cliente no la acepta; hay que registrar la aceptación para que el flujo continúe.',
      },
    ],
    backend: 'POST/PATCH /b2b/proposals',
  },

  '/operaciones/crm/aprobaciones': {
    eyebrow: 'CRM B2B',
    title: 'Cola de excepciones MDR',
    intro: 'Las decisiones comerciales que alguien pidió salirse de lo estándar y esperan un sí o un no.',
    sections: [
      {
        title: 'Qué llega a esta cola',
        body: 'Descuentos, tarifas fuera de rango y condiciones especiales. Nada llega aquí solo: alguien lo pidió desde una propuesta.',
      },
      {
        title: 'Decidir deja rastro permanente',
        body: 'Aprobar o rechazar queda registrado con tu identidad, la fecha y el motivo. No se puede deshacer discretamente: la corrección es otra decisión, también registrada.',
      },
      {
        title: 'El impacto estimado es orientativo',
        body: 'Sirve para priorizar la revisión, no para sustituirla. Una excepción pequeña repetida cien veces no es pequeña.',
      },
    ],
    backend: 'PATCH /b2b/proposals/approvals/:id/decision',
  },

  '/operaciones/crm/contratos': {
    eyebrow: 'CRM B2B',
    title: 'Contratos comerciales',
    intro: 'Convierte una propuesta aceptada en un contrato firmado y activo.',
    sections: [
      {
        title: 'El contrato hereda de la propuesta',
        body: 'No se teclean los términos otra vez: se generan desde la propuesta aceptada. Así lo firmado y lo aprobado no pueden diferir.',
      },
      {
        title: 'Firma y activación son dos cosas',
        body: 'Un contrato firmado todavía no habilita a operar. La activación es un control aparte —está en «Activación de comercio»— y exige que el onboarding esté cerrado.',
      },
      {
        title: 'Los responsables se identifican',
        body: 'Quién firma por Atlas y quién por el cliente son campos, no un detalle del PDF. Es lo que se consulta cuando hay una disputa.',
      },
    ],
    backend: 'POST/PATCH /b2b/contracts',
  },

  '/operaciones/crm/onboarding': {
    eyebrow: 'CRM B2B',
    title: 'Onboarding del comercio',
    intro: 'La lista de requisitos legales, operativos y técnicos que hay que cerrar antes de que un comercio pueda operar.',
    sections: [
      {
        title: 'Es un caso, no un formulario',
        body: 'Se abre, avanza por partes y se cierra. Varias personas de áreas distintas tocan el mismo caso, y por eso el estado vive en el servidor y no en la cabeza de quien lo lleva.',
      },
      {
        title: 'Cada requisito bloquea la activación',
        body: 'Mientras quede uno pendiente, el comercio no se activa. Es deliberado: activar sin los papeles es exactamente el riesgo que este caso existe para impedir.',
      },
      {
        title: 'Sucursales y usuarios se dan de alta aquí',
        body: 'Dónde opera el comercio y quién de su personal entra al portal. Se puede ampliar después, pero al menos uno de cada tiene que existir.',
      },
      {
        title: 'Todo se elige de una lista',
        body: 'El comercio, el responsable, el caso y el requisito salen de desplegables con nombres, no de identificadores tecleados. Al elegir un caso, la lista de requisitos se rellena con los suyos: no se puede completar un requisito de otro expediente.',
      },
    ],
    backend: 'GET/POST/PATCH /b2b/onboarding',
    tutorialId: 'crm-onboarding',
  },

  '/operaciones/crm/activacion-comercio': {
    eyebrow: 'CRM B2B',
    title: 'Activación de comercio',
    intro: 'El último control antes de habilitar a un comercio para operar de verdad en Atlas.',
    sections: [
      {
        title: 'Qué cambia al activar',
        body: 'El comercio pasa a poder originar operaciones, sus usuarios entran al portal y empieza a facturarse. Es el punto en el que deja de ser un expediente y pasa a ser un negocio en marcha.',
      },
      {
        title: 'Por eso hay una lista de comprobación',
        body: 'Contrato firmado, onboarding cerrado, sucursal habilitada. La pantalla no te deja activar con huecos, y eso es una función, no una molestia.',
      },
      {
        title: 'Revertir no es gratis',
        body: 'Desactivar un comercio ya activo afecta a operaciones vivas. Antes de activar, comprueba; después, la corrección es un caso.',
      },
      {
        title: 'El caso se elige por su nombre',
        body: 'El desplegable trae el nombre del comercio y cuántos requisitos le quedan pendientes. Si dice que quedan, el backend va a rechazar la activación: ciérralos primero en «Onboarding».',
      },
    ],
    backend: 'GET /b2b/onboarding/cases · PATCH /b2b/onboarding/cases/:id/activate',
  },

  '/operaciones/crm/facturacion': {
    eyebrow: 'CRM B2B',
    title: 'Facturación B2B',
    intro: 'Emite facturas al comercio por MDR y otros conceptos, y registra los pagos que llegan.',
    sections: [
      {
        title: 'Facturar y cobrar son dos pasos',
        body: 'Emitir la factura crea la deuda; registrar el pago la salda. Saltarse el segundo deja el saldo abierto aunque el dinero haya entrado.',
      },
      {
        title: 'El pago se aplica a una factura concreta',
        body: 'No basta con anotar que entró dinero: hay que decir a qué factura va. Sin esa aplicación explícita, ni el comercio ni Atlas saben qué se debe.',
      },
      {
        title: 'Esto es la cara comercial',
        body: 'El asiento contable correspondiente vive en Contabilidad. Son dos vistas del mismo hecho, y la contable es la que manda para los estados financieros.',
      },
    ],
    backend: 'POST /b2b/billing/*',
  },

  '/operaciones/crm/conciliacion-cobertura': {
    eyebrow: 'CRM B2B',
    title: 'Cobertura y conciliación',
    intro: 'Programa coberturas, confirma pagos, aplica recuperaciones y cuadra el período.',
    sections: [
      {
        title: 'Conciliar es comparar dos verdades',
        body: 'Lo que Atlas cree que se cobró contra lo que efectivamente entró. Mientras no coincidan, alguna de las dos está mal y hay que saber cuál.',
      },
      {
        title: 'El orden importa',
        body: 'Primero se programa la cobertura, después se confirman los pagos y sólo entonces se concilia el período. Al revés, se concilia contra datos incompletos.',
      },
      {
        title: 'Una recuperación no es un pago normal',
        body: 'Se aplica sobre algo que ya se dio por perdido, y por eso se registra aparte: mezclarlas distorsiona cualquier medida de morosidad.',
      },
    ],
    backend: 'POST/PATCH /b2b/coverage | reconciliation',
  },
};
