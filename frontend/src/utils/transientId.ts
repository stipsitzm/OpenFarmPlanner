type TransientIdPart = string | number;

export function createTransientId(...parts: TransientIdPart[]): string {
  return [
    ...parts.map(String),
    String(Date.now()),
    Math.random().toString(36).slice(2),
  ].join('-');
}
