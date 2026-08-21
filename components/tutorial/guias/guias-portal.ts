import type { ScreenGuide } from '../tutorial-types';

/**
 * Guías del portal del comercio.
 *
 * Estas las lee gente que NO trabaja en Atlas: el dueño de una tienda o quien
 * lleva su administración. El registro cambia en consecuencia —se tutea, se
 * evitan las siglas y no se menciona ningún endpoint— y el criterio para cada
 * texto es el mismo: decir qué pasa si pulsas, y a quién llamar si no es lo que
 * esperabas.
 */
export const GUIAS_PORTAL: Readonly<Record<string, ScreenGuide>> = {
  '/portal-comercio/planes': {
    eyebrow: 'Portal del comercio',
    title: 'Planes y suscripción',
    intro: 'El plan que tienes contratado y los que puedes contratar.',
    sections: [
      {
        title: 'Elegir un plan lo activa',
        body: 'No es una solicitud que alguien revisa después: al confirmar, la suscripción queda activa y las funciones incluidas se habilitan. Lo que cambia se refleja en tu facturación del período.',
      },
      {
        title: 'Qué mirar antes de cambiar',
        body: 'Cada plan lista lo que incluye. Si dependes de algo que el plan nuevo no trae, dejarás de tenerlo al cambiar.',
      },
      {
        title: 'Si algo no cuadra',
        body: 'Habla con tu ejecutivo comercial antes de cambiar. Deshacer una suscripción no es inmediato.',
      },
    ],
    tutorialId: 'portal-primeros-pasos',
  },

  '/portal-comercio/facturacion': {
    eyebrow: 'Portal del comercio',
    title: 'Consumo y facturación',
    intro: 'Lo que Atlas te ha facturado y lo que queda pendiente de pago.',
    sections: [
      {
        title: 'Facturas y saldos son cosas distintas',
        body: 'La lista de facturas es lo que se emitió; el saldo abierto es lo que todavía no se ha pagado. Una factura pagada sigue apareciendo en el historial.',
      },
      {
        title: 'El estado de cada factura',
        body: 'Emitida significa que hay que pagarla; vencida, que pasó su fecha. Pagada desaparece del saldo pero no del listado.',
      },
      {
        title: 'Si ya pagaste y sigue abierta',
        body: 'El pago se registra cuando se concilia, y eso puede tardar. Si pasan varios días, avisa con el número de factura a mano.',
      },
    ],
  },

  '/portal-comercio/campanas': {
    eyebrow: 'Portal del comercio',
    title: 'Tus campañas',
    intro: 'Enciende o pausa la publicidad de tu comercio.',
    sections: [
      {
        title: 'Lo que puedes hacer aquí',
        body: 'Activar y pausar. Crear campañas nuevas o cambiar a quién se dirigen se gestiona con tu ejecutivo comercial.',
      },
      {
        title: 'Si activar no funciona, el motivo lo dice la pantalla',
        body: 'Suelen ser dos: la creatividad todavía no está aprobada, o el presupuesto se agotó. Son problemas distintos y se resuelven distinto.',
      },
      {
        title: 'Pausar no pierde nada',
        body: 'La campaña conserva su presupuesto y su configuración. Volver a activarla la retoma donde estaba.',
      },
    ],
  },

  '/portal-comercio/sucursales-usuarios': {
    eyebrow: 'Portal del comercio',
    title: 'Sucursales y personal',
    intro: 'Dónde opera tu comercio y quién de tu equipo puede entrar al portal.',
    sections: [
      {
        title: 'Una sucursal es un local físico',
        body: 'Lo que se registre aquí es lo que aparecerá asociado a cada venta. Si una venta sale con la sucursal equivocada, empieza por mirar esta lista.',
      },
      {
        title: 'Dar acceso a alguien de tu equipo',
        body: 'Cada persona entra con su propio correo, no compartiendo el tuyo. Así se sabe quién hizo cada operación, que es lo que te protege a ti si algo sale mal.',
      },
      {
        title: 'Quitar el acceso',
        body: 'Retirar a alguien no borra lo que hizo: su historial se conserva, simplemente deja de poder entrar.',
      },
    ],
  },

  '/portal-comercio/compras-bnpl': {
    eyebrow: 'Portal del comercio',
    title: 'Registro de compras BNPL',
    intro: 'Registra una venta a crédito con el esquema 60/40 y su calendario de cuotas.',
    sections: [
      {
        title: 'Cómo se reparte el importe',
        body: 'El cliente paga el 60 % en el momento y el 40 % restante se financia en cuotas. La pantalla calcula ambas partes: tú sólo escribes el total de la compra.',
      },
      {
        title: 'Revisa el calendario antes de confirmar',
        body: 'Las fechas y los importes de las cuotas se muestran antes de registrar. Es lo que el cliente va a pagar, así que es el momento de comprobarlo con él delante.',
      },
      {
        title: 'Una vez registrada',
        body: 'La operación queda en firme y genera el compromiso de cobro. Corregir un error implica un ajuste, no una edición: registra con cuidado.',
      },
    ],
    tutorialId: 'portal-bnpl',
  },

  '/portal-comercio/cuenta': {
    eyebrow: 'Portal del comercio',
    title: 'Mi cuenta',
    intro: 'La seguridad de tu acceso al portal.',
    sections: [
      {
        title: 'Cambia la contraseña si sospechas de ella',
        body: 'Al cambiarla se cierran las demás sesiones abiertas con la anterior, que es justo lo que quieres si alguien más la conocía.',
      },
      {
        title: 'Una persona, un acceso',
        body: 'Si alguien más de tu equipo necesita entrar, dale su propio usuario desde «Sucursales» en lugar de compartir el tuyo.',
      },
    ],
  },
};
