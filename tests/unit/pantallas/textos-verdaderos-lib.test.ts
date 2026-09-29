import { describe, expect, it } from 'vitest';
import { describirModoFiscal } from '@/lib/modoFiscal';
import { resumenDeConciliacion } from '@/lib/conciliacionB2b';
import { atlasViewLinks, visibleViewLinks } from '@/lib/viewRegistry';
import { etiquetaEstadoCorreo } from '@/lib/estadoCorreo';

describe('modo de facturación electrónica', () => {
  it('servidor nuevo: usa su nota y no afirma envío real', () => {
    const modo = describirModoFiscal({ mode: 'mock_server', activo: true, transporteReal: false, nota: 'Emulador del SIN (pruebas): nada llega.' });
    expect(modo).toMatchObject({ real: false, apagada: false, aviso: 'Emulador del SIN (pruebas): nada llega.', destino: 'al emulador de Impuestos' });
  });
  it('servidor anterior (sin transporteReal ni nota): aviso prudente según el modo', () => {
    expect(describirModoFiscal({ mode: 'mock_server', activo: true }).aviso).toMatch(/no hay envío real a Impuestos/);
    expect(describirModoFiscal({ mode: 'disabled', activo: false })).toMatchObject({ apagada: true, real: false });
    expect(describirModoFiscal({ mode: 'disabled', activo: false }).aviso).toMatch(/representación interna/);
  });
  it('sólo con transporteReal=true dice «a Impuestos»', () => {
    expect(describirModoFiscal({ mode: 'produccion', activo: true, transporteReal: true, nota: 'Real.' }).destino).toBe('a Impuestos');
  });
});

describe('conciliación', () => {
  it('cuenta sólo las nuevas, dice las ya abiertas y que el detalle no se ve', () => {
    const aviso = resumenDeConciliacion({ items: [{ itemType: 'MDR' }, { itemType: 'MDR' }, { itemType: 'RECOVERY' }], alreadyOpenItemCount: 4 });
    expect(aviso.body).toContain('3 inconsistencia(s) nueva(s): 2 compras sin comisión, 1 coberturas pagadas sin recuperación.');
    expect(aviso.body).toContain('4 ya estaban abiertas');
    expect(resumenDeConciliacion({ items: [] }).body).toMatch(/^Ninguna inconsistencia nueva\./);
  });
});

describe('buscador de pantallas', () => {
  it('no ofrece Publicidad ni Notificaciones masivas cuando están ocultas', () => {
    const visibles = visibleViewLinks(atlasViewLinks, { publicidad: false, notificaciones: false });
    expect(visibles.some((view) => view.phase === 'Ads')).toBe(false);
    expect(visibles.some((view) => view.href === '/operaciones/admin/notificaciones')).toBe(false);
    expect(visibleViewLinks(atlasViewLinks, { publicidad: true, notificaciones: true })).toHaveLength(atlasViewLinks.length);
  });
});

it('un correo simulado no se lee como enviado', () => {
  expect(etiquetaEstadoCorreo('SIMULATED')).toBe('Simulado (no enviado)');
  expect(etiquetaEstadoCorreo('RARE_STATE')).toBe('RARE STATE');
});
