import { describe, expect, it } from 'vitest';
import { formDataToPayload, payloadDefinitions } from '@/lib/formPayload';
import type { ActionField } from '@/components/screens/StructuredActionForm';

const CAMPOS: ActionField[] = [
  { name: 'legalName', label: 'Razón social', required: true },
  { name: 'countryCode', label: 'País y ciudad', type: 'countryCity', cityFieldName: 'city', required: true },
  { name: 'address', label: 'Casa matriz', type: 'address', cityFieldName: 'city', countryFieldName: 'countryCode' },
] as ActionField[];

function formulario(valores: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(valores).forEach(([clave, valor]) => data.append(clave, valor));
  return data;
}

describe('payload de «País y ciudad»', () => {
  it('la ciudad elegida viaja en el payload (BUG-4)', () => {
    const payload = formDataToPayload(
      formulario({ legalName: 'Empresa QA', countryCode: 'BO', city: 'La Paz', address: 'Av. Ficticia 1' }),
      payloadDefinitions(CAMPOS),
    );
    expect(payload).toMatchObject({ countryCode: 'BO', city: 'La Paz', address: 'Av. Ficticia 1' });
  });

  it('sin ciudad elegida la clave no viaja (el campo es opcional)', () => {
    const payload = formDataToPayload(
      formulario({ legalName: 'Empresa QA', countryCode: 'BO', city: '', address: 'Av. Ficticia 1' }),
      payloadDefinitions(CAMPOS),
    );
    expect('city' in payload).toBe(false);
  });

  it('no duplica la definición si la ciudad ya es un campo declarado', () => {
    const conCiudad = [...CAMPOS, { name: 'city', label: 'Ciudad' } as ActionField];
    const nombres = payloadDefinitions(conCiudad).map((definicion) => definicion.name);
    expect(nombres.filter((nombre) => nombre === 'city')).toHaveLength(1);
  });

  it('un formulario sin countryCity no añade nada', () => {
    const nombres = payloadDefinitions([{ name: 'legalName', label: 'Razón social' } as ActionField]).map((d) => d.name);
    expect(nombres).toEqual(['legalName']);
  });
});
