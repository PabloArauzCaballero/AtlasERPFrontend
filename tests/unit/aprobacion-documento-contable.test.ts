import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ATL-03 / ERP-06: la pantalla ofrece lo que el servidor ya autorizó y no se inventa exenciones.
 * Son comprobaciones de contrato sobre la fuente: el backend es quien decide y vuelve a exigirlo.
 */
const pagina = readFileSync('app/operaciones/contabilidad/documentos/page.tsx', 'utf8');
const pantalla = readFileSync('components/screens/AccountingDocumentScreen.tsx', 'utf8');
const servicio = readFileSync('services/accountingService.ts', 'utf8');

describe('aprobación de documentos contables (ATL-03)', () => {
  it('ningún cliente escribe approvalStatus: lo decide el servidor', () => {
    expect(pantalla).not.toMatch(/approvalStatus:\s*['"]/);
    expect(pantalla).not.toMatch(/NOT_REQUIRED/);
    expect(pagina).not.toMatch(/approvalStatus:\s*['"]NOT_REQUIRED/);
  });

  it('el servicio expone aprobar y rechazar contra las rutas del backend', () => {
    expect(servicio).toContain('/accounting/documents/${documentId}/approve');
    expect(servicio).toContain('/accounting/documents/${documentId}/reject');
  });

  it('el listado muestra la aprobación, ofrece decidir sólo un borrador PENDING y contabilizar sólo lo autorizado', () => {
    expect(pagina).toContain("key: 'approvalStatus'");
    expect(pagina).toMatch(/esperaDecision[\s\S]*'DRAFT'[\s\S]*'PENDING'/);
    expect(pagina).toMatch(/puedeContabilizarse[\s\S]*\['NOT_REQUIRED', 'APPROVED'\]/);
    expect(pagina).toMatch(/key: 'contabilizar'[\s\S]*enabled: puedeContabilizarse/);
  });

  it('tras guardar, si el servidor lo dejó PENDING, la pantalla avisa y no deja contabilizar', () => {
    expect(pantalla).toContain("aprobacion === 'PENDING'");
    expect(pantalla).toContain('Queda pendiente de aprobación');
  });
});
