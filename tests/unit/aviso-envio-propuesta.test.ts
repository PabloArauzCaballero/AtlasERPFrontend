import { describe, expect, it } from 'vitest';
import { avisoDeEnvio } from '@/lib/avisoEnvioPropuesta';

describe('aviso al enviar una propuesta', () => {
  it('sin proveedor de correo NO dice «enviada»: avisa que no salió nada', () => {
    const aviso = avisoDeEnvio({ deliveries: [{ email: 'ana@multicenter.bo', status: 'SIMULATED' }] });
    expect(aviso.tone).toBe('warning');
    expect(aviso.title).toContain('NO salió');
    expect(aviso.body).toContain('ana@multicenter.bo');
  });

  it('enviada de verdad: dice a quién', () => {
    const aviso = avisoDeEnvio({
      deliveries: [{ email: 'ana@multicenter.bo', status: 'SENT' }],
      pdf: { attached: true, error: null },
    });
    expect(aviso).toEqual({
      title: 'Propuesta enviada',
      body: 'Enviada a ana@multicenter.bo, con la propuesta en PDF adjunta.',
      tone: 'success',
    });
  });

  it('si a alguno no le llegó, lo nombra', () => {
    const aviso = avisoDeEnvio({
      deliveries: [
        { email: 'ana@multicenter.bo', status: 'SENT' },
        { email: 'mal@multicenter.bo', status: 'FAILED' },
      ],
    });
    expect(aviso.tone).toBe('warning');
    expect(aviso.body).toContain('No se pudo enviar a mal@multicenter.bo');
  });

  it('si el PDF no se generó, lo avisa aunque el correo haya salido', () => {
    const aviso = avisoDeEnvio({
      deliveries: [{ email: 'ana@multicenter.bo', status: 'SENT' }],
      pdf: { attached: false, error: 'PDF_WORKER_NOT_CONFIGURED' },
    });
    expect(aviso.tone).toBe('warning');
    expect(aviso.body).toContain('El PDF no se pudo generar');
  });
});
