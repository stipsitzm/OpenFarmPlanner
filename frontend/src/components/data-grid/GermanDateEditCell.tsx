// Shared German date-text parse/format helpers used by DateEditCell.tsx (the
// actual date edit cell in use today - see docs/datagrid-architecture.md).
// The GermanDateEditCell component that used to live in this file was a
// simpler, non-segmented edit cell with no remaining renderEditCell usages
// anywhere in the app; it was removed as dead code, these helpers were not.
export const parseGermanDateText = (text: string): Date | null => {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
};

export const formatDateAsGerman = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
};
