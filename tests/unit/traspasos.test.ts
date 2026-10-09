import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRASPASO, dejarParaLaSiguientePantalla, recogerDeLaPantallaAnterior } from '@/lib/traspasoEfimero';
import { RUTA_BUSQUEDA_GLOBAL, alPedirBusquedaGlobal, busquedaPendiente, pedirBusquedaGlobal } from '@/lib/busquedaGlobal';

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('traspasoEfimero (ERP-09: datos personales fuera de la URL)', () => {
  it('entrega el valor una sola vez', () => {
    dejarParaLaSiguientePantalla(TRASPASO.correoARecuperar, 'persona@atlas.bo');
    expect(recogerDeLaPantallaAnterior(TRASPASO.correoARecuperar)).toBe('persona@atlas.bo');
    expect(recogerDeLaPantallaAnterior(TRASPASO.correoARecuperar)).toBeNull();
  });

  it('dejar un valor vacío borra el anterior', () => {
    dejarParaLaSiguientePantalla(TRASPASO.correoARecuperar, 'viejo@atlas.bo');
    dejarParaLaSiguientePantalla(TRASPASO.correoARecuperar, '');
    expect(recogerDeLaPantallaAnterior(TRASPASO.correoARecuperar)).toBeNull();
  });

  it('las claves no se pisan', () => {
    expect(new Set(Object.values(TRASPASO)).size).toBe(Object.values(TRASPASO).length);
  });

  it('sin almacenamiento no rompe: sólo se pierde el prellenado', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => dejarParaLaSiguientePantalla(TRASPASO.busquedaGlobal, 'x')).not.toThrow();
    expect(recogerDeLaPantallaAnterior(TRASPASO.busquedaGlobal)).toBeNull();
  });
});

describe('busquedaGlobal (ERP-09: lo tecleado no viaja en ?q=)', () => {
  it('la ruta no lleva parámetros', () => {
    expect(RUTA_BUSQUEDA_GLOBAL).toBe('/operaciones/admin/busqueda-global');
  });

  it('al navegar, la búsqueda espera a la pantalla y se borra al recogerla', () => {
    pedirBusquedaGlobal('1234567 LP');
    expect(busquedaPendiente()).toBe('1234567 LP');
    expect(busquedaPendiente()).toBe('');
  });

  it('con la pantalla abierta, llega por evento y no queda pendiente', () => {
    const recibidas: string[] = [];
    const baja = alPedirBusquedaGlobal((texto) => recibidas.push(texto));
    pedirBusquedaGlobal('factura');
    expect(recibidas).toEqual(['factura']);
    expect(busquedaPendiente()).toBe('');
    baja();
    pedirBusquedaGlobal('otra');
    expect(recibidas).toEqual(['factura']);
  });
});
