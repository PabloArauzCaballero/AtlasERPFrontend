export type FieldValueKind = 'string' | 'number' | 'boolean' | 'date' | 'stringList';

export interface PayloadFieldDefinition {
  name: string;
  valueKind?: FieldValueKind | undefined;
  optional?: boolean | undefined;
}

function convertValue(value: FormDataEntryValue, definition: PayloadFieldDefinition): unknown {
  const text = String(value).trim();
  if (definition.optional && text === '') return undefined;
  if (definition.valueKind === 'number') return Number(text);
  if (definition.valueKind === 'boolean') return text === 'true' || text === 'on';
  if (definition.valueKind === 'stringList') return [...new Set(text.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))];
  return text;
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
  if (value === undefined) return;
  const segments = path.split('.');
  let current = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    const existing = current[segment];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  });
}

/** Converts named form controls into the nested JSON contract expected by the API. */
export function formDataToPayload(formData: FormData, definitions: PayloadFieldDefinition[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  definitions.forEach((definition) => {
    const raw = formData.get(definition.name);
    if (raw === null) return;
    setNestedValue(payload, definition.name, convertValue(raw, definition));
  });
  return payload;
}
