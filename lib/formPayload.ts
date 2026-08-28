export type FieldValueKind = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'stringList';

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
  /*
   * `<input type="datetime-local">` entrega «2026-07-10T15:00» —sin segundos y sin zona—, y el
   * backend pide ISO 8601 completo. Se interpreta en la zona del navegador, que es la que el
   * usuario acaba de leer en el selector, y se manda en UTC; un texto que no sea una fecha se deja
   * pasar tal cual para que el error lo cuente el backend y no un `Invalid Date` mudo.
   */
  if (definition.valueKind === 'datetime') {
    const fecha = new Date(text);
    return Number.isNaN(fecha.getTime()) ? text : fecha.toISOString();
  }
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
