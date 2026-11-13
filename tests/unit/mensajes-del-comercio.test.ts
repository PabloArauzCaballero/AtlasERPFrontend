import { describe, expect, it } from 'vitest';
import catalogo from '@/lib/error-codes.json';
import {
  CODIGOS_DE_LISTA_VIEJA,
  CODIGOS_QUE_CIERRAN_LA_SOLICITUD,
  codigoDeNegocio,
  mensajeParaComercio,
  tieneMensajeParaComercio,
} from '@/lib/mensajesDelComercio';

type Entrada = { code: string; status: number; audience: string; field?: string };
const CATALOGO = catalogo as { contract: string; version: number; codes: Entrada[] };

describe('mensajes para el comercio', () => {
  it('todo código del catálogo del núcleo con audiencia merchant tiene su frase', () => {
    expect(CATALOGO.contract).toBe('atlas-error-codes');
    const sinFrase = CATALOGO.codes
      .filter((entrada) => entrada.audience === 'merchant')
      .map((entrada) => entrada.code)
      .filter((codigo) => !tieneMensajeParaComercio(codigo));
    expect(sinFrase).toEqual([]);
  });

  it('los códigos que cierran una solicitud o avisan de una lista vieja existen en el catálogo y tienen frase', () => {
    const conocidos = new Set(CATALOGO.codes.map((entrada) => entrada.code));
    for (const codigo of [...CODIGOS_QUE_CIERRAN_LA_SOLICITUD, ...CODIGOS_DE_LISTA_VIEJA]) {
      expect(conocidos.has(codigo)).toBe(true);
      expect(tieneMensajeParaComercio(codigo)).toBe(true);
    }
  });

  it('un código interno da el texto genérico y el código para soporte', () => {
    const interno = CATALOGO.codes.find((entrada) => entrada.audience === 'internal' && !tieneMensajeParaComercio(entrada.code))!;
    const texto = mensajeParaComercio({ code: interno.code, message: 'x' }, 'No pudimos completarlo.');
    expect(texto).toBe(`No pudimos completarlo. Si vuelve a pasar, avisa a soporte con el código ${interno.code}.`);
  });

  it('lee el código en error.code o, con un código genérico, en el prefijo del mensaje', () => {
    expect(codigoDeNegocio({ code: 'CREDIT_DECISION_EXPIRED', message: 'x' })).toBe('CREDIT_DECISION_EXPIRED');
    expect(codigoDeNegocio({ code: 'CONFLICT', message: 'CREDIT_EXPOSURE_LIMIT_EXCEEDED' })).toBe('CREDIT_EXPOSURE_LIMIT_EXCEEDED');
    expect(codigoDeNegocio({ message: 'CREDIT_BUSINESS_ACCEPTANCE_NOT_PENDING: la solicitud está en accepted.' })).toBe(
      'CREDIT_BUSINESS_ACCEPTANCE_NOT_PENDING',
    );
    expect(codigoDeNegocio({ code: 'CONFLICT', message: 'Ya existe.' })).toBeNull();
    expect(codigoDeNegocio(null)).toBeNull();
  });

  it('el cupo excedido se dice con palabras y cierra la solicitud', () => {
    const error = { code: 'CONFLICT', message: 'CREDIT_EXPOSURE_LIMIT_EXCEEDED' };
    expect(mensajeParaComercio(error)).toMatch(/no tiene cupo suficiente/);
    expect(CODIGOS_QUE_CIERRAN_LA_SOLICITUD.has(codigoDeNegocio(error)!)).toBe(true);
  });

  it('nunca imprime un código: uno desconocido cae a su familia o al respaldo', () => {
    const familia = mensajeParaComercio({ message: 'DOWN_PAYMENT_SOMETHING_NEW' });
    expect(familia).not.toMatch(/[A-Z]+_[A-Z]+/);
    expect(familia).toMatch(/pago inicial/);
    const respaldo = mensajeParaComercio({ code: 'WHATEVER_ODD_THING', message: 'WHATEVER_ODD_THING: detalle' }, 'Respaldo.');
    expect(respaldo).toBe('Respaldo.');
    expect(mensajeParaComercio({ message: 'Falló ZETA_CODE en medio' }, 'Respaldo.')).toBe('Respaldo.');
  });

  it('una frase humana del propio portal se respeta; un fallo del programa, no', () => {
    expect(mensajeParaComercio(new Error('No hay sesión de identidad para operar el expediente.'))).toBe(
      'No hay sesión de identidad para operar el expediente.',
    );
    expect(mensajeParaComercio(new TypeError('x.map is not a function'), 'Respaldo.')).toBe('Respaldo.');
  });
});
