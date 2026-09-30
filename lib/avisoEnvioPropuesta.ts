/**
 * El aviso dice a quién llegó y si de verdad salió: sin proveedor de correo el servidor lo deja
 * SIMULADO (no le llega nada al comercio), y eso no puede leerse como un envío.
 */
export function avisoDeEnvio(resultado: unknown): { title: string; body?: string; tone?: 'success' | 'warning' } {
  const entregas = (resultado as { deliveries?: Array<{ email: string; status: string }> } | null)?.deliveries ?? [];
  const enviados = entregas.filter((e) => e.status === 'SENT').map((e) => e.email);
  const simulados = entregas.filter((e) => e.status === 'SIMULATED').map((e) => e.email);
  const fallidos = entregas.filter((e) => e.status === 'FAILED').map((e) => e.email);
  if (simulados.length > 0 && enviados.length === 0) {
    return {
      title: 'Propuesta marcada como enviada, pero el correo NO salió',
      body: `Este servidor no tiene proveedor de correo configurado: ${simulados.join(', ')} no recibieron nada.`,
      tone: 'warning',
    };
  }
  return {
    title: 'Propuesta enviada',
    body: [
      enviados.length ? `Enviada a ${enviados.join(', ')}.` : '',
      fallidos.length ? `No se pudo enviar a ${fallidos.join(', ')}.` : '',
    ].filter(Boolean).join(' '),
    tone: fallidos.length ? 'warning' : 'success',
  };
}
