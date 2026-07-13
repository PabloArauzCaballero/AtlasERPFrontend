'use client';

import { useMemo, useState } from 'react';
import type { JsonObject, ResourceRow } from '@/services/types';
import { Button } from './button';
import { Card, CardTitle } from './card';
import { Textarea } from './input';
import { InlineLoading } from './LoadingIndicator';

interface JsonCommandCardProps {
  title: string;
  description: string;
  defaultPayload: JsonObject;
  submitLabel?: string;
  run: (payload: JsonObject) => Promise<ResourceRow>;
}

function parseJson(value: string): JsonObject {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El payload debe ser un objeto JSON.');
  }
  return parsed as JsonObject;
}

function getJsonParseError(value: string): string | null {
  try {
    parseJson(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'JSON inválido.';
  }
}

export function JsonCommandCard({ description, defaultPayload, run, submitLabel = 'Ejecutar', title }: JsonCommandCardProps) {
  const [payloadText, setPayloadText] = useState(JSON.stringify(defaultPayload, null, 2));
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parseError = useMemo(() => getJsonParseError(payloadText), [payloadText]);

  async function handleSubmit() {
    setError(null);
    setResult(null);

    if (parseError) {
      setError(parseError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await run(parseJson(payloadText));
      setResult(JSON.stringify(response, null, 2));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card aria-busy={isSubmitting} className="space-y-4">
      <div>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
      </div>
      <Textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
      {parseError ? <p className="text-xs text-amber-700">JSON pendiente de corregir: {parseError}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={Boolean(parseError)} isLoading={isSubmitting} loadingLabel="Procesando" onClick={handleSubmit}>{submitLabel}</Button>
        {isSubmitting ? <InlineLoading text="Esperando respuesta del backend" /> : null}
      </div>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {result ? <pre className="custom-scrollbar max-h-72 overflow-auto rounded-lg bg-surface-muted p-3 text-xs">{result}</pre> : null}
    </Card>
  );
}
