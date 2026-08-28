'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { b2bService } from '@/services/b2bService';
import { loadSegmentAttributes } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * Segmentos comerciales: clientes solicitantes de crédito y partners.
 *
 * Existía UNA pantalla de segmentos —la de audiencia publicitaria, en Ads— y en el menú convivía
 * con «Usuarios», que son los usuarios internos del propio ERP. Las tres cosas se leían como lo
 * mismo y no lo son:
 *
 * - el **usuario ERP** no se segmenta, se administra: tiene rol y permisos (Control › Usuarios);
 * - la **audiencia de Ads** es a quién se le SIRVE un anuncio (Ads › Segmentos de audiencia);
 * - el **partner** y el **cliente solicitante de crédito** son población comercial, y es lo que
 *   se segmenta aquí.
 *
 * El formulario compone UNA regla, que es lo que cubre la mayoría de los casos reales (un rubro,
 * una banda de mora, una ciudad). Las definiciones de varias reglas se dan de alta por API, y la
 * acción de fila que corrige la regla se esconde en ellas para no colapsar a una lo que se creó
 * con tres.
 */

const OPERADORES = ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'BETWEEN', 'EXISTS'];
const LISTA = ['IN', 'NOT_IN', 'BETWEEN'];

/** El alta y la corrección de la regla piden lo mismo; sólo cambia de dónde salen los valores. */
function camposDeRegla(actual?: { attribute?: string; operator?: string; value?: unknown }): ActionField[] {
  const valor = Array.isArray(actual?.value) ? actual?.value.join(', ') : actual?.value;
  return [
    {
      name: 'attribute',
      label: 'Atributo',
      type: 'select',
      required: true,
      span: 2,
      optionsLoader: loadSegmentAttributes,
      hint: 'El prefijo dice de qué sujeto es: un segmento de partners no puede mirar la mora de un solicitante.',
      ...(actual?.attribute ? { defaultValue: actual.attribute } : {}),
    },
    {
      name: 'operator',
      label: 'Operador',
      type: 'select',
      required: true,
      options: OPERADORES.map((value) => ({ label: value, value })),
      ...(actual?.operator ? { defaultValue: actual.operator } : {}),
    },
    {
      name: 'value',
      label: 'Valor',
      optional: true,
      placeholder: 'FARMACIA, MERCADO',
      hint: 'IN, NOT_IN y BETWEEN llevan varios valores separados por coma; BETWEEN espera dos números (30, 90). EXISTS no lleva valor.',
      ...(valor !== undefined && valor !== null ? { defaultValue: String(valor) } : {}),
    },
  ];
}

/** Del formulario plano a la definición que espera el backend. */
function definicionDesde(payload: JsonObject) {
  const { attribute, operator, value } = payload;
  const texto = String(value ?? '');
  const esLista = LISTA.includes(String(operator));
  const valor = esLista
    ? texto.split(',').map((item) => item.trim()).filter(Boolean)
    : texto;

  return {
    match: 'ALL',
    rules: [
      {
        attribute,
        operator,
        ...(String(operator) === 'EXISTS' ? {} : { value: valor }),
      },
    ],
  };
}

function reglaUnica(row: ResourceRow): { attribute?: string; operator?: string; value?: unknown } | undefined {
  const definition = row.definition as { rules?: Array<Record<string, unknown>> } | undefined;
  const rules = definition?.rules ?? [];
  return rules.length === 1 ? (rules[0] as { attribute?: string; operator?: string; value?: unknown }) : undefined;
}

export default function CrmSegmentsPage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => b2bService.listCrmSegments(), [version]);
  const recargar = () => setVersion((value) => value + 1);

  return (
    <CrudDirectory
      moduleLabel="CRM"
      title="Segmentos comerciales"
      description="A quién agrupa cada criterio: clientes que solicitan crédito y partners. El alcance se recalcula en cada carga."
      load={load}
      labelKey="name"
      searchPlaceholder="Buscar por nombre, regla o responsable…"
      emptyHint="Crea el primer segmento para agrupar solicitantes de crédito o partners por un criterio."
      notice={{
        tone: 'info',
        title: 'Esto no son los usuarios del ERP ni la audiencia de Ads',
        body: 'Aquí se agrupa población comercial: clientes solicitantes de crédito (por su comportamiento de pago, nunca por su identidad —el ERP sólo guarda una referencia opaca—) y partners (por su cuenta B2B). Los usuarios internos del ERP no se segmentan: se administran en Control › Usuarios. Y los segmentos de audiencia de Ads deciden a quién se le SIRVE un anuncio, que es otra pregunta.',
      }}
      columns={[
        { key: 'name', label: 'Segmento' },
        { key: 'subjectLabel', label: 'Agrupa a' },
        { key: 'rules', label: 'Regla' },
        { key: 'size', label: 'Alcance', align: 'right' },
        { key: 'population', label: 'Población', align: 'right' },
        { key: 'sample', label: 'Ejemplos', kind: 'list' },
        { key: 'status', label: 'Estado', kind: 'status' },
        { key: 'ownerName', label: 'Responsable' },
        { key: 'updatedAt', label: 'Actualizado', kind: 'date' },
      ]}
      filters={[
        {
          key: 'subject',
          label: 'Sujeto',
          options: [
            { label: 'Clientes solicitantes de crédito', value: 'CREDIT_APPLICANT' },
            { label: 'Partners', value: 'PARTNER' },
          ],
        },
        {
          key: 'status',
          label: 'Estado',
          options: [
            { label: 'Activo', value: 'ACTIVE' },
            { label: 'Inactivo', value: 'INACTIVE' },
          ],
        },
      ]}
      create={{
        label: 'Crear segmento',
        title: 'Nuevo segmento comercial',
        description: 'Primero a quién agrupa: es lo que decide qué atributos puede mirar la regla, y no se puede cambiar después.',
        fields: [
          {
            name: 'subject',
            label: 'Agrupa a',
            type: 'select',
            required: true,
            span: 2,
            options: [
              { label: 'Clientes solicitantes de crédito', value: 'CREDIT_APPLICANT' },
              { label: 'Partners', value: 'PARTNER' },
            ],
          },
          { name: 'name', label: 'Nombre del segmento', required: true, span: 2 },
          { name: 'description', label: 'Para qué se usa', optional: true, span: 2 },
          ...camposDeRegla(),
        ],
        submit: async (payload) => {
          const { subject, name, description, ...regla } = payload;
          const created = await b2bService.createCrmSegment({
            subject,
            name,
            ...(description ? { description } : {}),
            definition: definicionDesde(regla),
          });
          recargar();
          return created;
        },
      }}
      edit={{
        description: 'El sujeto y la regla no se tocan aquí: para corregir el criterio está la acción «Cambiar la regla» de la fila.',
        fields: [
          { name: 'name', label: 'Nombre del segmento', required: true, span: 2 },
          { name: 'description', label: 'Para qué se usa', optional: true, span: 2 },
          {
            name: 'status',
            label: 'Estado',
            type: 'select',
            options: [
              { label: 'Activo', value: 'ACTIVE' },
              { label: 'Inactivo', value: 'INACTIVE' },
            ],
          },
        ],
        submit: (id, payload) => b2bService.updateCrmSegment(id, payload),
      }}
      extraActions={[
        {
          key: 'regla',
          label: 'Cambiar la regla',
          icon: 'rule',
          // Sólo donde hay UNA regla: colapsar a una un segmento creado con tres por API sería
          // cambiarle la población sin que quien lo edita lo hubiera pedido.
          enabled: (row) => Boolean(reglaUnica(row)),
          form: {
            title: (row) => `Regla de «${String(row.name ?? '')}»`,
            description: 'El atributo tiene que ser del mismo sujeto que ya agrupa el segmento; si no, el alta se rechaza diciendo cuáles admite.',
            fields: (row) => camposDeRegla(reglaUnica(row)),
            submit: (row, payload) =>
              b2bService.updateCrmSegment(String(row.id ?? ''), { definition: definicionDesde(payload) }),
            submitLabel: 'Guardar la regla',
          },
        },
      ]}
      remove={{
        submit: (id) => b2bService.deleteCrmSegment(id),
        warning: 'Un segmento es un criterio, no un vínculo: borrarlo no cambia ninguna cuenta ni ningún cliente. Si sólo quieres dejar de usarlo, márcalo como inactivo.',
      }}
    />
  );
}
