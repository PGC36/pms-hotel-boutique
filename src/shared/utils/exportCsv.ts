export type CsvHeader<T extends Record<string, unknown>> = {
  key: keyof T;
  label: string;
};

function escapeCsvValue(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Descarga una colección como CSV UTF-8 sin crear archivos cuando no hay datos. */
export function exportToCSV<T extends Record<string, unknown>>(
  fileName: string,
  data: readonly T[],
  headers: readonly CsvHeader<T>[],
): boolean {
  if (data.length === 0 || headers.length === 0 || typeof document === 'undefined') return false;

  const rows = [
    headers.map((header) => escapeCsvValue(header.label)),
    ...data.map((row) => headers.map((header) => escapeCsvValue(row[header.key]))),
  ];
  const csv = `\uFEFF${rows.map((row) => row.join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function exportDateSuffix(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
