import type { ScreenGuide } from '../tutorial-types';

/**
 * Guías del módulo de Publicidad.
 *
 * La cadena de este módulo: anunciante → campaña → segmento → moderación →
 * entrega → facturación. Una campaña no entrega si no está aprobada, y no se
 * factura lo que no se entregó. Casi todas las preguntas de «¿por qué no está
 * saliendo mi anuncio?» se responden mirando el estado de aprobación y el
 * presupuesto, en ese orden.
 */
export const GUIAS_ADS: Readonly<Record<string, ScreenGuide>> = {
  '/operaciones/ads/dashboard': {
    eyebrow: 'Publicidad',
    title: 'Tablero de publicidad',
    intro: 'El estado de salud del negocio publicitario en una pantalla: facturación, entrega, moderación y fraude.',
    sections: [
      {
        title: 'Para qué mirar esto',
        body: 'Responde «¿hay algo que atender hoy?» sin abrir cinco pantallas. Cada bloque es la puerta de entrada a su módulo.',
      },
      {
        title: 'Los números son del backend, no estimaciones',
        body: 'Si un indicador sale en cero, es que no hay actividad registrada en ese corte, no que falte el dato.',
      },
      {
        title: 'Las señales de fraude son alertas, no veredictos',
        body: 'Marcan tráfico a revisar. La decisión de excluirlo de la facturación se toma en el monitor de delivery.',
      },
    ],
    backend: 'GET /admin/ads/dashboard',
  },

  '/operaciones/ads/anunciantes': {
    eyebrow: 'Publicidad',
    title: 'Directorio de anunciantes',
    intro: 'Quién puede pautar en Atlas, cómo se le factura y cuánto crédito tiene.',
    sections: [
      {
        title: 'El anunciante es quien paga',
        body: 'Una campaña siempre cuelga de un anunciante: es contra él que se acumula el gasto y a él a quien se factura.',
      },
      {
        title: 'Prepago y pospago se comportan distinto',
        body: 'En prepago la campaña deja de entregar al agotar el saldo; en pospago sigue hasta el límite de crédito. La modalidad se define aquí y se sufre en la entrega.',
      },
      {
        title: 'El anunciante puede ser un comercio',
        body: 'Cuando lo es, queda enlazado a su cuenta y sus campañas aparecen en el portal del comercio. Sin ese enlace, el comercio no las ve.',
      },
    ],
    backend: 'GET/POST /admin/ads/advertisers',
    tutorialId: 'ads-anunciantes',
  },

  '/operaciones/ads/anunciantes/crear': {
    eyebrow: 'Publicidad',
    title: 'Crear anunciante',
    intro: 'Registra identidad fiscal, contacto, modalidad de facturación y límite de crédito.',
    sections: [
      {
        title: 'El límite de crédito va en micros',
        body: 'Un millón de micros es una unidad de moneda. Se guarda así para poder sumar sin errores de redondeo, que en publicidad —donde cada impresión vale una fracción— importan de verdad.',
        tip: 'Bs 500 se escriben como 500000000.',
      },
      {
        title: 'El país y el NIT identifican',
        body: 'La combinación de ambos es la que detecta duplicados. Un NIT repetido en el mismo país es el mismo anunciante.',
      },
      {
        title: 'Nace sin campañas',
        body: 'Crear el anunciante sólo abre la cuenta. Las campañas se crean después y necesitan aprobación antes de entregar.',
      },
    ],
    backend: 'POST /admin/ads/advertisers',
  },

  '/operaciones/ads/bulk-anunciantes': {
    eyebrow: 'Publicidad',
    title: 'Carga masiva de anunciantes',
    intro: 'Importa anunciantes desde una plantilla con control de duplicados y validación previa.',
    sections: [
      {
        title: 'El duplicado se detecta por país y NIT',
        body: 'Las filas que ya existen se marcan antes de enviar nada. Es la razón principal para usar esta pantalla en lugar de crear uno a uno.',
      },
      {
        title: 'Los límites de crédito van en micros',
        body: 'Igual que en el alta individual. Una columna con el importe «normal» produce anunciantes con un millonésimo del crédito previsto.',
      },
      {
        title: 'Revisa la vista previa',
        body: 'Se valida en tu navegador, fila por fila, antes de tocar la base. Corrige en el archivo y recarga.',
      },
    ],
    backend: 'POST /admin/ads/advertisers/bulk',
    tutorialId: 'carga-masiva',
  },

  '/operaciones/ads/campanas': {
    eyebrow: 'Publicidad',
    title: 'Campañas',
    intro: 'El seguimiento de cada campaña: presupuesto, aprobación, entrega y estado.',
    sections: [
      {
        title: 'Dos estados que se confunden',
        body: 'El estado operativo (activa, pausada) dice qué quiere el anunciante; el de aprobación (aprobada, rechazada) dice qué permite Atlas. Una campaña activa pero no aprobada NO entrega.',
      },
      {
        title: 'El presupuesto la frena sola',
        body: 'Al agotarse el total, la campaña deja de entregar aunque siga activa. Es la protección que impide gastar más de lo comprometido.',
      },
      {
        title: 'Activar puede fallar, y el motivo importa',
        body: '«No aprobada» se resuelve en moderación; «presupuesto agotado», ampliándolo. Son dos problemas distintos con el mismo síntoma.',
      },
    ],
    backend: 'GET/POST/PATCH /admin/ads/campaigns',
    tutorialId: 'ads-campanas',
  },

  '/operaciones/ads/segmentos': {
    eyebrow: 'Publicidad',
    title: 'Segmentos de audiencia',
    intro: 'A quién alcanza cada conjunto de anuncios.',
    sections: [
      {
        title: 'Sin segmento se entrega a todos',
        body: 'No es un error, es el comportamiento por defecto, y suele ser el motivo de un gasto más alto de lo esperado con menos conversión.',
      },
      {
        title: 'El segmento se reutiliza',
        body: 'Se define una vez y lo usan varias campañas. Cambiarlo afecta a todas: revisa quién lo está usando antes de tocarlo.',
      },
    ],
    backend: 'GET/POST /admin/ads/segments',
  },

  '/operaciones/ads/moderacion': {
    eyebrow: 'Publicidad',
    title: 'Cola de moderación',
    intro: 'Las creatividades que esperan revisión antes de poder salir.',
    sections: [
      {
        title: 'Nada entrega sin pasar por aquí',
        body: 'Es el control previo: una campaña con creatividad no aprobada no se activa, por mucho presupuesto que tenga.',
      },
      {
        title: 'La decisión queda registrada',
        body: 'Aprobar o rechazar se guarda con tu identidad y el motivo. Un rechazo sin motivo escrito deja al anunciante sin saber qué corregir.',
      },
      {
        title: 'Rechazar no borra',
        body: 'La creatividad sigue existiendo, marcada. El anunciante sube una versión nueva; no se pierde la historia de lo que se rechazó y por qué.',
      },
    ],
    backend: 'GET/POST /admin/ads/moderation',
  },

  '/operaciones/ads/delivery-monitor': {
    eyebrow: 'Publicidad',
    title: 'Monitor de entrega y fraude',
    intro: 'El registro técnico de qué se entregó, qué parece fraudulento y qué es facturable.',
    sections: [
      {
        title: 'Aquí se decide qué se cobra',
        body: 'Las impresiones marcadas como no elegibles quedan fuera de la facturación. Es la pantalla que separa «se sirvió» de «se cobra».',
      },
      {
        title: 'Las señales de fraude son señales',
        body: 'Indican un patrón sospechoso —frecuencia anómala, origen dudoso—, no una certeza. La revisión humana es el paso que falta.',
      },
      {
        title: 'Es un ledger: no se edita',
        body: 'Los eventos de entrega son historia. Lo que se cambia es su clasificación de elegibilidad, y ese cambio también queda registrado.',
      },
    ],
    backend: 'GET/PATCH /admin/ads/delivery-monitor | events',
  },
};
