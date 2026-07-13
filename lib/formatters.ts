const bobFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeZone: 'America/La_Paz',
});

export function formatBob(value: number): string {
  return bobFormatter.format(value);
}

export function formatMicrosAsBob(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric)
    ? formatBob(numeric / 1_000_000)
    : '—';
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function maskPii(value: unknown, fieldName: string): string {
  if (value === null || value === undefined) return '—';
  const text = String(value);
  const normalized = fieldName.toLowerCase();

  if (normalized.includes('email')) {
    const [name, domain] = text.split('@');
    return name && domain ? `${name.slice(0, 2)}***@${domain}` : '***';
  }

  if (normalized.includes('phone')) return text.replace(/\d(?=\d{3})/g, '*');
  if (normalized.includes('tax') || normalized.includes('nit')) return `${text.slice(0, 2)}***`;
  return text;
}
