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
    const aviso = avisoDeEnvio({ deliveries: [{ email: 'ana@multicenter.bo', status: 'SENT' }] });
    expect(aviso).toEqual({ title: 'Propuesta enviada', body: 'Enviada a ana@multicenter.bo.', tone: 'success' });
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
});
