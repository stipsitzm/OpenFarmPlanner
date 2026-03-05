type Translator = (key: string, options?: Record<string, unknown>) => string;

export type ImportEntryPartition = {
  validEntries: Record<string, unknown>[];
  invalidEntries: string[];
};

export const partitionImportEntries = (
  entries: unknown[],
  t: Translator,
): ImportEntryPartition => {
  const invalidEntries: string[] = [];
  const validEntries: Record<string, unknown>[] = [];

  entries.forEach((entry, index) => {
    const nameValue = (entry as { name?: unknown }).name;
    if (typeof nameValue === 'string' && nameValue.trim().length > 0) {
      validEntries.push(entry as Record<string, unknown>);
    } else {
      invalidEntries.push(`${t('import.invalidEntry')} ${index + 1}`);
    }
  });

  return { validEntries, invalidEntries };
};

export const readFileAsText = (file: File): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File could not be read'));
    reader.readAsText(file);
  })
);
