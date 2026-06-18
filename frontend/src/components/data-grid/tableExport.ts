import * as XLSX from 'xlsx';
import type { TableExportFormat } from './ExportFormatDialog';
import type { TableClipboardRow } from './tableClipboard';

const MIME_TYPES: Record<Exclude<TableExportFormat, 'json'>, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv;charset=utf-8',
};

const triggerDownload = (data: Uint8Array | string, filename: string, mimeType: string): void => {
  const blob = new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export function exportVisibleTable(
  rows: readonly TableClipboardRow[],
  format: TableExportFormat,
  options: { filenameBase: string; sheetName: string; tableType: string },
): void {
  const date = new Date().toISOString().split('T')[0];
  const filename = `${options.filenameBase}_${date}.${format}`;

  if (format === 'json') {
    const [headers = [], ...dataRows] = rows;
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      type: options.tableType,
      columns: headers,
      rows: dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))),
    };
    triggerDownload(JSON.stringify(payload, null, 2), filename, 'application/json');
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows.map((row) => [...row]));
  worksheet['!cols'] = (rows[0] ?? []).map((header) => ({
    wch: Math.min(Math.max(header.length + 4, 12), 40),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName.slice(0, 31));
  const output = XLSX.write(workbook, { bookType: format, type: 'array' }) as Uint8Array;
  triggerDownload(output, filename, MIME_TYPES[format]);
}
