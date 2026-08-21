import type { ScreenGuide } from '../tutorial-types';

/**
 * Guías del módulo de Contabilidad.
 *
 * Lo que hay que entender antes de cualquier pantalla concreta: la contabilidad
 * de Atlas se monta de abajo arriba y NO se puede saltar peldaños. Entidad legal
 * → plan de cuentas → cuentas GL → períodos y libros → y sólo entonces
 * documentos. Casi todo el «no me deja» de este módulo es en realidad «falta algo
 * de la capa de abajo»: un desplegable vacío aquí casi nunca es un error, es una
 * dependencia sin crear.
 *
 * Y una regla que atraviesa el módulo entero: los asientos NO se editan. Un
 * asiento equivocado se corrige con otro asiento, porque un libro que se puede
 * reescribir no prueba nada.
 */
export const GUIAS_CONTABILIDAD: Readonly<Record<string, ScreenGuide>> = {
  '/operaciones/contabilidad/estructura': {
    eyebrow: 'Contabilidad',
    title: 'Entidad legal',
    intro: 'Crea la empresa jurídica que encabeza libros, períodos, impuestos y documentos.',
    sections: [
      {
        title: 'Es el cimiento de todo el módulo',
        body: 'Ninguna cuenta, período, factura ni asiento existe sin colgar de una entidad legal. Si estás empezando de cero, esta es la primera pantalla.',
      },
      {
        title: 'Entidad legal no es sucursal',
        body: 'La entidad es la persona jurídica que declara impuestos; las sucursales son sus ubicaciones y se crean después, en «Sucursales y años fiscales».',
      },
      {
        title: 'Cambiarla luego es caro',
        body: 'Los datos fiscales se propagan a documentos ya emitidos. Verifícalos contra el papel antes de guardar.',
      },
    ],
    backend: 'POST /accounting/financial-structure/*',
  },

  '/operaciones/contabilidad/impuestos-coa': {
    eyebrow: 'Contabilidad',
    title: 'Impuestos y plan de cuentas',
    intro: 'Versiona el plan de cuentas y registra los códigos tributarios con su vigencia.',
    sections: [
      {
        title: 'El plan de cuentas se versiona, no se edita',
        body: 'Cada versión tiene fechas de vigencia. Los asientos viejos siguen apuntando a la versión con la que se hicieron, que es lo que permite reimprimir un balance de hace dos años y que salga igual.',
      },
      {
        title: 'Un código tributario tiene fechas',
        body: 'Las tasas cambian por ley. Registrar la vigencia —y no sólo el porcentaje— es lo que hace que una factura de enero se calcule con la tasa de enero.',
      },
      {
        title: 'Sin esto no hay cuentas GL',
        body: 'Una cuenta GL se crea DENTRO de una versión vigente del plan. Si el desplegable de versiones aparece vacío al crear una cuenta, es esta pantalla la que falta.',
      },
    ],
    backend: 'POST /charts-of-accounts | tax-codes',
  },

  '/operaciones/contabilidad/cuentas-gl': {
    eyebrow: 'Contabilidad',
    title: 'Cuentas GL (plan de cuentas)',
    intro: 'El catálogo de cuentas contra las que se registra cada movimiento contable.',
    sections: [
      {
        title: 'Una cuenta GL es un cajón donde cae el dinero',
        body: 'Caja, bancos, clientes, ingresos, impuestos. Todo asiento mueve importe entre dos o más de estos cajones, y la suma de lo que entra y lo que sale tiene que dar cero.',
      },
      {
        title: 'Las banderas de control no son decoración',
        body: 'Que una cuenta exija centro de costo, partner o dimensión determina qué campos serán obligatorios al usarla. Se configuran aquí, se sufren al asentar.',
      },
      {
        title: 'Se desactiva, no se borra',
        body: 'Una cuenta con movimientos no puede desaparecer sin llevarse la historia por delante. Lo que se hace es dejar de admitir asientos nuevos.',
      },
    ],
    backend: 'GET/POST /accounting/financial-structure/gl-accounts',
    tutorialId: 'contabilidad-cuentas-gl',
  },

  '/operaciones/contabilidad/cuentas-gl/crear': {
    eyebrow: 'Contabilidad',
    title: 'Crear cuenta GL',
    intro: 'Define una cuenta nueva dentro de una versión vigente del plan y configura sus exigencias.',
    sections: [
      {
        title: 'El código es para siempre',
        body: 'Es lo que aparecerá en cada asiento y en cada informe. Sigue la numeración del plan que ya existe en lugar de inventar una nueva.',
      },
      {
        title: 'La clasificación decide en qué estado aparece',
        body: 'Activo, pasivo, patrimonio, ingreso o gasto. Clasificar mal una cuenta no da error: da un balance que no cuadra con la realidad.',
      },
      {
        title: 'Las dimensiones obligatorias se piden después',
        body: 'Marcar aquí que la cuenta exige centro de costo significa que nadie podrá asentar contra ella sin indicarlo. Es la forma de garantizar analítica completa.',
      },
    ],
    backend: 'POST /accounting/financial-structure/gl-accounts',
  },

  '/operaciones/contabilidad/cuentas-gl/detalle': {
    eyebrow: 'Contabilidad',
    title: 'Ficha de la cuenta GL',
    intro: 'La configuración de una cuenta y su comportamiento en los asientos.',
    sections: [
      {
        title: 'Se llega desde el listado',
        body: 'La ficha necesita saber qué cuenta mostrar, y ese dato viaja en la dirección. Ábrela desde «Cuentas GL» con el icono de detalle.',
      },
      {
        title: 'Lo que ves aquí es lo que exigirá el asiento',
        body: 'Si un asiento se queja de un campo obligatorio que no esperabas, esta ficha dice por qué.',
      },
    ],
    backend: 'GET /accounting/financial-structure/gl-accounts/:id',
  },

  '/operaciones/contabilidad/grupos-cuenta': {
    eyebrow: 'Contabilidad',
    title: 'Grupos de cuenta',
    intro: 'El árbol con el que las cuentas se agrupan para presentar estados financieros.',
    sections: [
      {
        title: 'Es una taxonomía de REPORTE',
        body: 'Balance General → Activo → Corriente → … Sirve para presentar, no para asentar. Una cuenta puede existir sin grupo; simplemente no aparecerá agrupada en los informes.',
      },
      {
        title: 'Es independiente de la jerarquía de cuentas',
        body: 'El código de la cuenta ya tiene su propio orden. Este árbol es otra vista, pensada para quien lee estados financieros, no para quien registra.',
      },
    ],
    backend: 'GET/POST /accounting/account-groups',
  },

  '/operaciones/contabilidad/periodos-ledgers': {
    eyebrow: 'Contabilidad',
    title: 'Períodos y libros',
    intro: 'Configura los meses contables y los libros paralelos (local, gerencial, IFRS).',
    sections: [
      {
        title: 'Un asiento necesita un período abierto',
        body: 'Si al registrar un documento el sistema dice que no hay período, es esta pantalla la que falta. Los períodos se crean por adelantado, no cuando hacen falta.',
      },
      {
        title: 'Libros paralelos: los mismos hechos, tres lecturas',
        body: 'El mismo movimiento puede valorarse distinto según norma local, criterio gerencial o IFRS. Por eso son libros separados y no columnas del mismo.',
      },
      {
        title: 'Cerrar un período no se hace aquí',
        body: 'Aquí se definen; el cierre es una operación aparte, en «Cierre de períodos», con sus propios controles.',
      },
    ],
    backend: 'POST /fiscal-years | periods | ledgers',
  },

  '/operaciones/contabilidad/sucursales-fiscales': {
    eyebrow: 'Contabilidad',
    title: 'Sucursales y años fiscales',
    intro: 'Define las sucursales contables y los ejercicios de una entidad legal ya registrada.',
    sections: [
      {
        title: 'Cuelgan de una entidad legal',
        body: 'Si el desplegable de entidades está vacío, primero hay que crear la entidad en «Entidad legal». No es un fallo de esta pantalla.',
      },
      {
        title: 'El año fiscal acota los períodos',
        body: 'Los meses contables se crean dentro de un ejercicio. Sin ejercicio no hay períodos, y sin períodos no hay asientos.',
      },
      {
        title: 'La sucursal contable no es la sucursal del comercio',
        body: 'Ésta es una unidad de los libros de Atlas. Las sucursales de un comercio afiliado se gestionan en su onboarding y en su portal.',
      },
    ],
    backend: 'POST /branches | fiscal-years',
  },

  '/operaciones/contabilidad/business-partners': {
    eyebrow: 'Contabilidad',
    title: 'Business partners',
    intro: 'El maestro financiero de contrapartes: clientes, proveedores, comercios, bancos.',
    sections: [
      {
        title: 'Es la contraparte de los asientos',
        body: 'Cuando un movimiento involucra a alguien de fuera —se le debe, nos debe, se le paga—, ese alguien es un business partner. Sin él, el saldo existe pero no se sabe de quién es.',
      },
      {
        title: 'No es lo mismo que una cuenta B2B',
        body: 'La cuenta B2B es la relación COMERCIAL; el partner es la identidad FINANCIERA. A menudo describen a la misma empresa, y aun así se registran aparte porque responden a preguntas distintas.',
      },
      {
        title: 'El estado KYB condiciona lo que se puede hacer',
        body: 'Un partner sin verificación completa tiene limitadas las operaciones que admite. Es un control, no un trámite.',
      },
    ],
    backend: 'GET/POST /accounting/business-partners',
  },

  '/operaciones/contabilidad/business-partners/crear': {
    eyebrow: 'Contabilidad',
    title: 'Crear business partner',
    intro: 'Da de alta una contraparte financiera con su identidad legal y su estado KYB.',
    sections: [
      {
        title: 'Identidad legal, no nombre comercial',
        body: 'Razón social y NIT tal y como figuran en el documento. Es lo que aparecerá en facturas y lo que se cruza con registros externos.',
      },
      {
        title: 'El rol decide qué cuentas usa',
        body: 'Cliente, proveedor, banco o comercio determinan las cuentas por defecto con las que operará. Se puede ajustar después en su ficha.',
      },
    ],
    backend: 'POST /accounting/business-partners',
  },

  '/operaciones/contabilidad/business-partners/detalle': {
    eyebrow: 'Contabilidad',
    title: 'Ficha del business partner',
    intro: 'Identidad, cuentas por defecto y movimientos de una contraparte.',
    sections: [
      {
        title: 'Las cuentas por defecto ahorran errores',
        body: 'Fijar aquí contra qué cuenta GL se registra normalmente este partner evita elegirla a mano —y elegirla mal— en cada documento.',
      },
      {
        title: 'Se abre desde el listado',
        body: 'La ficha necesita el identificador del partner en la dirección; llega hasta ella desde «Business partners».',
      },
    ],
    backend: 'GET /accounting/business-partners/:id',
  },

  '/operaciones/contabilidad/contratos': {
    eyebrow: 'Contabilidad',
    title: 'Contratos contables',
    intro: 'Registra cabeceras de contrato y sus términos versionados para facturación recurrente.',
    sections: [
      {
        title: 'Para qué sirve un contrato contable',
        body: 'Es la base de lo que se factura periódicamente sin volver a teclearlo: alquileres, servicios, préstamos, intercompany.',
      },
      {
        title: 'Los términos se versionan',
        body: 'Cuando cambian las condiciones se añade una versión con su vigencia, no se sobrescribe la anterior. Así una factura vieja se sigue pudiendo explicar.',
      },
      {
        title: 'No es el contrato comercial del CRM',
        body: 'Aquél formaliza la relación con el comercio; éste alimenta la contabilidad. Pueden referirse al mismo acuerdo y aun así son registros distintos.',
      },
    ],
    backend: 'POST /accounting/contracts',
  },

  '/operaciones/contabilidad/documentos': {
    eyebrow: 'Contabilidad',
    title: 'Documentos contables',
    intro: 'Registra asientos —el hecho contable básico— y consulta los ya emitidos.',
    sections: [
      {
        title: 'Debe y haber tienen que cuadrar',
        body: 'La pantalla no deja registrar un asiento descuadrado, y el total al pie te dice en cada momento cuánto falta. No es una validación caprichosa: un asiento descuadrado rompe el balance entero.',
      },
      {
        title: 'Cada línea es un movimiento en una cuenta',
        body: 'Cuenta GL, importe, y las dimensiones que esa cuenta exija (partner, centro de costo). Si un campo se vuelve obligatorio de repente, es la cuenta la que lo pide.',
      },
      {
        title: 'Los asientos son inmutables',
        body: 'Una vez registrado, el documento no se edita ni se borra. Un error se corrige con un asiento nuevo que lo revierte. El listado de abajo es de sólo lectura por eso mismo.',
      },
      {
        title: 'Necesita período abierto',
        body: 'Si el sistema rechaza la fecha, revisa «Períodos y libros»: el mes al que apuntas puede no existir o estar cerrado.',
      },
    ],
    backend: 'POST/PATCH /accounting/documents',
    tutorialId: 'contabilidad-documento',
  },

  '/operaciones/contabilidad/bulk-documentos': {
    eyebrow: 'Contabilidad',
    title: 'Carga masiva de documentos',
    intro: 'Sube hasta 50 asientos de dos líneas en un solo lote transaccional.',
    sections: [
      {
        title: 'Dos líneas, ya cuadradas',
        body: 'El formato admite el caso simple: una cuenta al debe y otra al haber por el mismo importe. Los asientos complejos se registran uno a uno.',
      },
      {
        title: 'Vista previa antes de enviar',
        body: 'Se valida fila por fila en tu navegador. Corrige en el archivo y vuelve a cargarlo: es más rápido que enviar y descubrirlo después.',
      },
      {
        title: 'Todo o nada',
        body: 'El lote entra completo o no entra. No hay estado intermedio con la mitad de los asientos publicados.',
      },
    ],
    backend: 'POST /accounting/documents/bulk',
    tutorialId: 'carga-masiva',
  },

  '/operaciones/contabilidad/factura-ar': {
    eyebrow: 'Contabilidad',
    title: 'Factura por cobrar (AR)',
    intro: 'Emite una factura a un cliente y genera su asiento de cliente, ingresos e impuestos.',
    sections: [
      {
        title: 'Una factura es un asiento con formato',
        body: 'Al emitirla se propone el asiento correspondiente: cliente al debe, ingreso e impuesto al haber. Revisar esa propuesta antes de confirmar es el control principal de esta pantalla.',
      },
      {
        title: 'El impuesto sale del código tributario',
        body: 'No se teclea el importe: se elige el código y el sistema calcula con la tasa vigente en la fecha de la factura.',
      },
      {
        title: 'Emitida no es cobrada',
        body: 'La factura crea la cuenta por cobrar. El dinero se registra aparte, en «Registrar recibo», y es allí donde se aplica contra esta factura.',
      },
    ],
    backend: 'POST /accounting/billing/ar-invoices',
  },

  '/operaciones/contabilidad/recibos': {
    eyebrow: 'Contabilidad',
    title: 'Recibos',
    intro: 'Registra el dinero que entra y aplícalo contra las facturas abiertas.',
    sections: [
      {
        title: 'Aplicar es la mitad del trabajo',
        body: 'Anotar que entraron 1.000 Bs no dice nada si no se indica qué facturas salda. Sin aplicación, la factura sigue figurando como pendiente aunque esté pagada.',
      },
      {
        title: 'El cuadre es obligatorio',
        body: 'Lo aplicado tiene que igualar lo recibido. Un cobro parcial se aplica parcialmente; lo que no se puede es dejar diferencia sin explicar.',
      },
      {
        title: 'Cada fila del listado es un cobro real',
        body: 'El historial de abajo es de consulta: los recibos, como los asientos, no se editan.',
      },
    ],
    backend: 'POST /accounting/receipts',
  },

  '/operaciones/contabilidad/cierres': {
    eyebrow: 'Contabilidad',
    title: 'Cierre de períodos',
    intro: 'Cierra o reabre un mes contable por entidad legal y tipo de cierre.',
    sections: [
      {
        title: 'Cerrar es congelar',
        body: 'Un período cerrado deja de admitir asientos. Es lo que permite afirmar que un balance publicado no va a cambiar por debajo.',
      },
      {
        title: 'Se cierra por partes',
        body: 'El cierre puede ser por área antes de ser definitivo. Eso permite bloquear lo que ya está revisado sin frenar lo que sigue en curso.',
      },
      {
        title: 'Reabrir es excepcional y queda registrado',
        body: 'Existe porque a veces hace falta, no porque sea normal. Quién reabrió qué período y cuándo es exactamente lo que mira una auditoría.',
      },
    ],
    backend: 'POST/PATCH /accounting/closings/*',
  },
};
