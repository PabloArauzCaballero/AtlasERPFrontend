/**
 * El aviso dice a quién llegó, si de verdad salió y si llevaba el PDF: sin proveedor de correo el
 * servidor lo deja SIMULADO (no le llega nada al comercio), y sin generador documental el correo
 * sale sin el PDF. Ninguna de las dos cosas puede leerse como un envío completo.
 */
export function avisoDeEnvio(resultado: unknown): { title: string; body?: string; tone?: 'success' | 'warning' } {
  const respuesta = resultado as {
    deliveries?: Array<{ email: string; status: string }>;
    pdf?: { attached: boolean; error: string | null };
  } | null;
  const entregas = respuesta?.deliveries ?? [];
  const sinPdf = respuesta?.pdf ? !respuesta.pdf.attached : false;
  const avisoPdf = sinPdf ? 'El PDF no se pudo generar: el correo llevó las condiciones en el texto, sin el documento.' : '';
  const enviados = entregas.filter((e) => e.status === 'SENT').map((e) => e.email);
  const simulados = entregas.filter((e) => e.status === 'SIMULATED').map((e) => e.email);
  const fallidos = entregas.filter((e) => e.status === 'FAILED').map((e) => e.email);
  if (simulados.length > 0 && enviados.length === 0) {
    return {
      title: 'Propuesta marcada como enviada, pero el correo NO salió',
      body: [`Este servidor no tiene proveedor de correo configurado: ${simulados.join(', ')} no recibieron nada.`, avisoPdf]
        .filter(Boolean)
        .join(' '),
      tone: 'warning',
    };
  }
  return {
    title: 'Propuesta enviada',
    body: [
      enviados.length ? `Enviada a ${enviados.join(', ')}${sinPdf ? '' : ', con la propuesta en PDF adjunta'}.` : '',
      fallidos.length ? `No se pudo enviar a ${fallidos.join(', ')}.` : '',
      avisoPdf,
    ].filter(Boolean).join(' '),
    tone: fallidos.length || sinPdf ? 'warning' : 'success',
  };
}
