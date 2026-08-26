/** Parses a CSV line supporting quoted values and escaped double quotes. */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { current += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { values.push(current.trim()); current = ''; continue; }
    current += character;
  }
  values.push(current.trim());
  return values;
}

/** Converts CSV text into records using the first row as normalized headers. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? '';
      return record;
    }, {});
  });
}

export function downloadCsvTemplate(filename: string, headers: string[]): void {
  triggerCsvDownload(filename, `${headers.join(',')}\n`);
}

/** Escapa un valor para CSV: comillas dobladas y envuelto si trae coma, comilla o salto de línea. */
function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Exporta filas ya cargadas a un CSV descargable. `columns` fija el orden y las cabeceras
 * legibles; `render` (opcional) da el texto plano de cada celda para no volcar objetos crudos.
 */
export function downloadCsv(
  filename: string,
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, unknown>>,
  render?: (row: Record<string, unknown>, key: string) => unknown,
): void {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCsvCell(render ? render(row, column.key) : row[column.key])).join(','))
    .join('\n');
  // El BOM inicial hace que Excel abra los acentos (UTF-8) sin pedir el asistente de importación.
  triggerCsvDownload(filename, `﻿${header}\n${body}\n`);
}

function triggerCsvDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
