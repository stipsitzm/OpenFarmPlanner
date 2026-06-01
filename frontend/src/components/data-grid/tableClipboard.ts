export type TableClipboardRow = readonly string[];

interface ClipboardSnackbarDetail {
  message: string;
  severity?: 'success' | 'error';
}

const sanitizeTsvCell = (value: string): string => value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();

export function formatClipboardValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString('de-DE');
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatClipboardValue).filter(Boolean).join(', ');
  }
  return String(value);
}

export function buildTsv(rows: readonly TableClipboardRow[]): string {
  return rows
    .map((row) => row.map(sanitizeTsvCell).join('\t'))
    .join('\n');
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available.');
  }
  await navigator.clipboard.writeText(text);
}

export function showClipboardSnackbar(detail: ClipboardSnackbarDetail): void {
  window.dispatchEvent(new CustomEvent('ofp:show-snackbar', { detail }));
}
