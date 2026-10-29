/**
 * Las cinco banderas de una cuenta contable, con su etiqueta y su ayuda en español.
 *
 * Las pantallas las derivaban del nombre del campo (`isControlAccount` → «is Control Account»),
 * y quien daba de alta una cuenta leía inglés a medias y sin ninguna explicación de qué activa
 * cada una (QA 2026-10-29, OBS-27).
 */
export const BANDERAS_CUENTA_GL = [
  {
    name: 'isControlAccount',
    label: 'Cuenta de control',
    tooltip:
      'Sí = sólo se mueve por los documentos de su módulo (cuentas por cobrar, por pagar…); no admite asientos manuales.',
  },
  {
    name: 'requiresCostCenter',
    label: 'Exige centro de costo',
    tooltip:
      'Sí = cada movimiento en esta cuenta debe indicar su centro de costo.',
  },
  {
    name: 'requiresProfitCenter',
    label: 'Exige centro de beneficio',
    tooltip:
      'Sí = cada movimiento en esta cuenta debe indicar su centro de beneficio.',
  },
  {
    name: 'requiresPartner',
    label: 'Exige socio de negocio',
    tooltip:
      'Sí = cada movimiento en esta cuenta debe indicar el cliente o proveedor.',
  },
  {
    name: 'requiresTaxCode',
    label: 'Exige código de impuesto',
    tooltip:
      'Sí = cada movimiento en esta cuenta debe indicar su código de impuesto.',
  },
] as const;

export const NOMBRES_BANDERAS_CUENTA_GL: string[] = BANDERAS_CUENTA_GL.map(
  (bandera) => bandera.name,
);
