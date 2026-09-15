'use client';

import { useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  notificationCampaignsService,
  type AudienceAttribute,
  type AudienceDefinition,
  type AudienceEstimate,
  type AudienceOperator,
  type AudienceRule,
  type CampaignPurpose,
} from '@/services/notificationCampaignsService';
import { ATTRIBUTE_META, ATTRIBUTE_OPTIONS, OPERATOR_LABELS, errorMessage, formatCount } from './campaignCatalog';

/**
 * Constructor de audiencia: reglas sobre atributos del cliente y el tamaño de la audiencia EN VIVO.
 *
 * El recuento es lo que convierte un segmento en una decisión: «clientes de Beni con cuota vencida y
 * push activo» puede ser 4 personas o 4.000, y programar sin saberlo es enviar a ciegas. Se pide al
 * backend con un respiro de medio segundo tras el último cambio, no en cada tecla.
 */

interface AudienceBuilderProps {
  value: AudienceDefinition;
  onChange: (value: AudienceDefinition) => void;
  purpose: CampaignPurpose;
  /** Estimación ya calculada por quien usa el constructor; si viene, no se vuelve a pedir. */
  onEstimate?: (estimate: AudienceEstimate | null) => void;
}

function ruleIsComplete(rule: AudienceRule): boolean {
  const kind = ATTRIBUTE_META[rule.attribute].valueKind(rule.operator);
  if (kind === 'none') return true;
  if (kind === 'list') return Array.isArray(rule.value) && rule.value.length > 0;
  if (kind === 'number') return typeof rule.value === 'number' && Number.isFinite(rule.value);
  return typeof rule.value === 'string' && rule.value.trim().length > 0;
}

function defaultRule(attribute: AudienceAttribute): AudienceRule {
  const meta = ATTRIBUTE_META[attribute];
  const [operator = 'is_true'] = meta.operators;
  const kind = meta.valueKind(operator);
  if (kind === 'none') return { attribute, operator };
  if (kind === 'number') return { attribute, operator, value: 30 };
  if (kind === 'select') return { attribute, operator, value: meta.options?.[0]?.value ?? '' };
  return { attribute, operator, value: kind === 'list' ? [] : '' };
}

function RuleRow({ rule, onChange, onRemove, index }: { rule: AudienceRule; onChange: (rule: AudienceRule) => void; onRemove: () => void; index: number }) {
  const meta = ATTRIBUTE_META[rule.attribute];
  const kind = meta.valueKind(rule.operator);
  const changeOperator = (operator: AudienceOperator) => {
    const nextKind = meta.valueKind(operator);
    const base = { attribute: rule.attribute, operator };
    if (nextKind === 'none') onChange(base);
    else if (nextKind === 'list') onChange({ ...base, value: Array.isArray(rule.value) ? rule.value : rule.value ? [String(rule.value)] : [] });
    else if (nextKind === 'number') onChange({ ...base, value: typeof rule.value === 'number' ? rule.value : 30 });
    else onChange({ ...base, value: Array.isArray(rule.value) ? (rule.value[0] ?? '') : String(rule.value ?? meta.options?.[0]?.value ?? '') });
  };

  return (
    <div className="grid grid-cols-1 items-end gap-3 rounded-md border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-[1.3fr_1fr_1.4fr_auto]">
      <FormField
        kind="select"
        label={`Condición ${index + 1}`}
        tooltip="Dato del cliente por el que se filtra la audiencia: ciudad, mora, edad…"
        name={`attribute-${index}`}
        hint={meta.hint}
        value={rule.attribute}
        options={ATTRIBUTE_OPTIONS}
        onChange={(event) => onChange(defaultRule(event.target.value as AudienceAttribute))}
      />
      <FormField tooltip="Cómo se compara el atributo con el valor."
        kind="select"
        label="Operador"
        name={`operator-${index}`}
        hint="Cómo se compara."
        value={rule.operator}
        options={meta.operators.map((operator) => ({ value: operator, label: OPERATOR_LABELS[operator] }))}
        onChange={(event) => changeOperator(event.target.value as AudienceOperator)}
      />
      {kind === 'none' ? (
        <p className="pb-2 text-xs text-slate-500">Sin valor: la condición se cumple o no.</p>
      ) : kind === 'select' ? (
        <FormField tooltip="Valor con el que se compara."
          kind="select"
          label="Valor"
          name={`value-${index}`}
          hint="Elige uno."
          value={String(rule.value ?? '')}
          options={meta.options ?? []}
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
        />
      ) : kind === 'number' ? (
        <FormField
          label={`Valor (${meta.unit ?? 'número'})`}
          tooltip={`Valor numérico con el que se compara, en ${meta.unit ?? 'número entero'}.`}
          name={`value-${index}`}
          type="number"
          min={0}
          hint="Número entero."
          value={typeof rule.value === 'number' ? rule.value : ''}
          onChange={(event) => onChange({ ...rule, value: event.target.value === '' ? Number.NaN : Number(event.target.value) })}
        />
      ) : (
        <FormField
          label={kind === 'list' ? 'Valores (separados por coma)' : 'Valor'}
          tooltip={kind === 'list' ? 'Varios valores admitidos, separados por coma. Ej.: LP, SC.' : 'Valor exacto con el que se compara.'}
          name={`value-${index}`}
          hint={meta.options ? `Por ejemplo: ${meta.options.slice(0, 3).map((option) => option.label).join(', ')}.` : 'No distingue mayúsculas.'}
          value={Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value ?? '')}
          onChange={(event) =>
            onChange({
              ...rule,
              value:
                kind === 'list'
                  ? event.target.value.split(',').map((item) => item.trim()).filter(Boolean)
                  : event.target.value,
            })
          }
        />
      )}
      <AtlasButton variant="ghost" icon="delete" onClick={onRemove} aria-label={`Quitar la condición ${index + 1}`}>
        Quitar
      </AtlasButton>
    </div>
  );
}

export function AudienceBuilder({ value, onChange, purpose, onEstimate }: AudienceBuilderProps) {
  const [estimate, setEstimate] = useState<AudienceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = value.rules.every(ruleIsComplete);
  const debounced = useDebouncedValue(JSON.stringify({ value, purpose }), 500);

  useEffect(() => {
    const { value: definition, purpose: currentPurpose } = JSON.parse(debounced) as { value: AudienceDefinition; purpose: CampaignPurpose };
    if (!definition.rules.every(ruleIsComplete)) return;
    let cancelled = false;
    setEstimating(true);
    setError(null);
    notificationCampaignsService
      .estimate({ purpose: currentPurpose, audience: definition })
      .then((result) => {
        if (cancelled) return;
        setEstimate(result);
        onEstimate?.(result);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setEstimate(null);
        onEstimate?.(null);
        setError(errorMessage(failure));
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });
    return () => {
      cancelled = true;
    };
    // `onEstimate` puede cambiar de identidad en cada render de quien lo usa; el disparo lo manda la definición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const update = (index: number, rule: AudienceRule) => onChange({ ...value, rules: value.rules.map((current, i) => (i === index ? rule : current)) });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <FormField tooltip="Con varias condiciones: si deben cumplirse todas o basta con una."
          kind="select"
          label="Quién entra"
          name="match"
          hint="Con varias condiciones: todas a la vez o basta una."
          className="w-72"
          value={value.match}
          options={[
            { value: 'all', label: 'Cumple TODAS las condiciones' },
            { value: 'any', label: 'Cumple AL MENOS UNA condición' },
          ]}
          onChange={(event) => onChange({ ...value, match: event.target.value as 'all' | 'any' })}
        />
        <AtlasButton
          variant="secondary"
          icon="add"
          disabled={value.rules.length >= 10}
          onClick={() => onChange({ ...value, rules: [...value.rules, defaultRule('department')] })}
        >
          Añadir condición
        </AtlasButton>
      </div>

      {value.rules.length === 0 ? (
        <InlineNotice tone="info" title="Sin condiciones">
          La audiencia son todos los clientes activos{purpose === 'marketing' ? ' que aceptaron recibir promociones' : ''}. Los bloqueados y
          las cuentas cerradas nunca reciben.
        </InlineNotice>
      ) : (
        value.rules.map((rule, index) => (
          <RuleRow
            key={`${index}-${rule.attribute}`}
            index={index}
            rule={rule}
            onChange={(next) => update(index, next)}
            onRemove={() => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) })}
          />
        ))
      )}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-3" aria-live="polite">
        {[
          { label: 'Personas en la audiencia', value: estimate?.total, icon: 'groups' },
          { label: 'Con la app y avisos activos', value: estimate?.withPushDevice, icon: 'notifications_active' },
          { label: 'Con correo verificado', value: estimate?.withVerifiedEmail, icon: 'mail' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <Icon name={item.icon} className="text-[22px] text-slate-500" />
            <div>
              <p className="text-lg font-extrabold tabular-nums text-slate-900">{estimating || !complete ? '…' : formatCount(item.value)}</p>
              <p className="text-[11px] text-slate-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
      {!complete ? <p className="text-xs text-amber-700">Completa las condiciones para calcular la audiencia.</p> : null}
      {purpose === 'marketing' ? (
        <p className="text-[11px] text-slate-500">Campaña comercial: el recuento ya descuenta a quien no aceptó recibir promociones.</p>
      ) : null}
      {error ? <InlineNotice tone="danger" title="No se pudo calcular la audiencia">{error}</InlineNotice> : null}
    </div>
  );
}
