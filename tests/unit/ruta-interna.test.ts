import { describe, expect, it } from 'vitest';
import { rutaInternaSegura } from '@/lib/rutaInterna';

const ORIGEN = 'https://erp.atlas.test';

describe('rutaInternaSegura (ERP-05: sin redirección abierta tras el login)', () => {
  it.each([
    ['/operaciones', '/operaciones'],
    ['/operaciones/admin?pestana=2#arriba', '/operaciones/admin?pestana=2#arriba'],
    ['/portal/../operaciones', '/operaciones'],
  ])('acepta la ruta interna %s', (valor, esperado) => {
    expect(rutaInternaSegura(valor, ORIGEN)).toBe(esperado);
  });

  it.each([
    null,
    undefined,
    '',
    'operaciones',
    'https://clon.example/login',
    'http://erp.atlas.test/operaciones',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//clon.example',
    '/\\clon.example',
    '/\t/clon.example',
    '/\n/clon.example',
    '/ /clon.example',
    '/\u0000x',
    '/a\\b',
  ])('rechaza %j', (valor) => {
    expect(rutaInternaSegura(valor, ORIGEN)).toBeNull();
  });

  it('sin origen explícito usa el de la ventana', () => {
    expect(rutaInternaSegura('/operaciones')).toBe('/operaciones');
    expect(rutaInternaSegura('//clon.example')).toBeNull();
  });
});
