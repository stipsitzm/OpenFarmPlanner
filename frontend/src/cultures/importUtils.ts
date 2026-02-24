export interface ParsedCultureImport {
  entries: Record<string, unknown>[];
  originalCount: number;
}

type ImportEnvelope = {
  type?: unknown;
  culture?: unknown;
  cultures?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toCentimeters = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return value * 100;
};

export const normalizeImportCultureEntry = (entry: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...entry };

  if (typeof normalized.supplierName === 'string' && normalized.supplierName.trim().length > 0) {
    normalized.supplier_name = normalized.supplierName;
  }

  if (
    (typeof normalized.supplier_name !== 'string' || normalized.supplier_name.trim().length === 0) &&
    typeof normalized.seed_supplier === 'string' &&
    normalized.seed_supplier.trim().length > 0
  ) {
    normalized.supplier_name = normalized.seed_supplier;
  }

  if (normalized.distance_within_row_cm === undefined) {
    const cm = toCentimeters(normalized.distance_within_row_m);
    if (cm !== undefined) {
      normalized.distance_within_row_cm = cm;
    }
  }

  if (normalized.row_spacing_cm === undefined) {
    const cm = toCentimeters(normalized.row_spacing_m);
    if (cm !== undefined) {
      normalized.row_spacing_cm = cm;
    }
  }

  if (normalized.sowing_depth_cm === undefined) {
    const cm = toCentimeters(normalized.sowing_depth_m);
    if (cm !== undefined) {
      normalized.sowing_depth_cm = cm;
    }
  }

  delete normalized.supplierName;
  delete normalized.distance_within_row_m;
  delete normalized.row_spacing_m;
  delete normalized.sowing_depth_m;
  delete normalized.schemaVersion;
  delete normalized.exportedAt;
  delete normalized.type;

  return normalized;
};

const extractImportItems = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!isRecord(parsed)) {
    throw new Error('not_array');
  }

  const envelope = parsed as ImportEnvelope;

  if (envelope.type === 'culture' && isRecord(envelope.culture)) {
    return [envelope.culture];
  }

  if (envelope.type === 'cultures' && Array.isArray(envelope.cultures)) {
    return envelope.cultures;
  }

  throw new Error('not_array');
};

export const parseCultureImportJson = (jsonString: string): ParsedCultureImport => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch {
    const cleanedJson = jsonString.replace(/,\s*([}\]])/g, '$1');
    parsed = JSON.parse(cleanedJson);
  }

  const rawItems = extractImportItems(parsed);
  const entries = rawItems.filter(isRecord).map(normalizeImportCultureEntry);

  return {
    entries,
    originalCount: rawItems.length,
  };
};
