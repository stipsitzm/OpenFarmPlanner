export function resolveRouterBasename(configuredBase: string, pathname: string): string {
  const normalizedBase = configuredBase.replace(/\/$/, '');
  if (!normalizedBase) {
    return '';
  }
  if (pathname === normalizedBase || pathname.startsWith(`${normalizedBase}/`)) {
    return normalizedBase;
  }
  return '';
}
