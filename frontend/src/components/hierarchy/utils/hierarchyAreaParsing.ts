export const parseAreaExpression = (input: string): number | undefined => {
  const normalizedInput = input.trim().replace(/,/g, '.');
  if (!normalizedInput) {
    return undefined;
  }

  const factors = normalizedInput
    .split(/[*x×]/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (factors.length === 0) {
    return undefined;
  }

  let product = 1;
  for (const factor of factors) {
    if (!/^\d+(\.\d+)?$/.test(factor)) {
      return undefined;
    }
    const numeric = Number.parseFloat(factor);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    product *= numeric;
  }

  return Number.isFinite(product) ? product : undefined;
};

export const normalizeAreaValue = (
  value: number | undefined,
): number | undefined => {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value * 10) / 10;
};

export const parseAreaValue = (
  value: number | string | undefined,
): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return parseAreaExpression(value);
  }
  return undefined;
};

export const parseDimensionValue = (
  value: number | string | null | undefined,
): number | null | undefined => {
  if (value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number.parseFloat(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};
