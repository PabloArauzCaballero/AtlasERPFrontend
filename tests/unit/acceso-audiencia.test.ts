import { afterEach, describe, expect, it } from 'vitest';
import { RUTA_LOGIN, audienciaRecordada, recordarAudiencia, resolverLogin } from '@/lib/accesoAudiencia';

afterEach(() => window.localStorage.clear());

describe('resolverLogin · a qué puerta va quien llega a /login', () => {
  it('la primera vez, sin nada recordado, abre el acceso del comercio', () => {
    expect(resolverLogin(null, null)).toBe('/login/comercios');
  });

  it('vuelve a la puerta por la que este navegador entró la última vez', () => {
    expect(resolverLogin(null, 'internal')).toBe('/login/interno');
    expect(resolverLogin(null, 'merchant')).toBe('/login/comercios');
  });

  it('una pantalla del portal del comercio manda al acceso del comercio, aunque se recuerde el interno', () => {
    expect(resolverLogin('/portal-comercio/gestion-pos', 'internal')).toBe('/login/comercios');
    expect(resolverLogin('/portal-comercio', 'internal')).toBe('/login/comercios');
  });

  it('cualquier otra pantalla manda al acceso interno y se conserva para volver', () => {
    expect(resolverLogin('/operaciones/crm?tab=2', 'merchant')).toBe(
      `/login/interno?next=${encodeURIComponent('/operaciones/crm?tab=2')}`,
    );
  });

  it('un prefijo parecido no cuenta como portal del comercio', () => {
    expect(resolverLogin('/portal-comercio-falso', null)).toMatch(/^\/login\/interno\?next=/);
  });
});

describe('la puerta recordada', () => {
  it('sin nada guardado no inventa una', () => {
    expect(audienciaRecordada()).toBeNull();
  });

  it('recuerda la última y descarta un valor que no es una puerta', () => {
    recordarAudiencia('merchant');
    expect(audienciaRecordada()).toBe('merchant');

    window.localStorage.setItem('atlas_last_audience', 'otra-cosa');
    expect(audienciaRecordada()).toBeNull();
  });

  it('cada población tiene su dirección', () => {
    expect(RUTA_LOGIN).toEqual({ internal: '/login/interno', merchant: '/login/comercios' });
  });
});
