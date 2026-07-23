export interface MainNavigationItem {
  to: string;
  labelKey: string;
  keywords: string[];
  activeAliases?: string[];
}

export const MAIN_NAV_ITEMS: MainNavigationItem[] = [
  { to: '/app/fields-beds', labelKey: 'fieldsAndBeds', keywords: ['anbauflächen', 'felder', 'beete'] },
  { to: '/app/cultures', labelKey: 'cultures', keywords: ['kulturen', 'kultur'] },
  { to: '/app/crop-library', labelKey: 'cropLibrary', activeAliases: ['/app/crops'], keywords: ['kulturbibliothek', 'öffentliche kulturen', 'crop library'] },
  { to: '/app/anbauplaene', labelKey: 'plantingPlans', activeAliases: ['/app/planting-plans'], keywords: ['anbaupläne', 'pläne', 'planung'] },
  { to: '/app/gantt-chart', labelKey: 'ganttChart', keywords: ['anbaukalender', 'kalender', 'gantt'] },
  { to: '/app/yield-overview', labelKey: 'yieldOverview', keywords: ['ertragsübersicht', 'ertrag', 'ernte'] },
  { to: '/app/seed-demand', labelKey: 'seedDemand', keywords: ['saatgutbedarf', 'saatgut'] },
  { to: '/app/suppliers', labelKey: 'suppliers', keywords: ['lieferanten', 'einkauf'] },
];

export const MAIN_NAV_ROUTES = MAIN_NAV_ITEMS.map((item) => item.to);
export const KEYBOARD_NAV_ROUTES = ['/app/dashboard', ...MAIN_NAV_ROUTES];
export const ORDERED_APP_ROUTES = KEYBOARD_NAV_ROUTES;

export const normalizeMainRoutePath = (pathname: string): string => {
  const normalizedPath = pathname.replace(/\/$/, '') || '/';
  if (normalizedPath === '/planting-plans') {
    return '/app/anbauplaene';
  }
  if (normalizedPath.startsWith('/app/')) {
    return normalizedPath;
  }
  return normalizedPath === '/' ? '/app/dashboard' : `/app${normalizedPath}`;
};

export const getActiveMainRouteFromPathname = (pathname: string): string | null => {
  const normalizedPath = normalizeMainRoutePath(pathname);
  const aliasedPath = normalizedPath === '/app/planting-plans'
    ? '/app/anbauplaene'
    : normalizedPath;

  const matchingRoute = KEYBOARD_NAV_ROUTES
    .filter((route) => aliasedPath === route || aliasedPath.startsWith(`${route}/`))
    .sort((first, second) => second.length - first.length)[0];

  return matchingRoute ?? null;
};

export const getKeyboardNavigationRouteFromPathname = (pathname: string): string | null => {
  const activeRoute = getActiveMainRouteFromPathname(pathname);
  if (activeRoute) {
    return activeRoute;
  }

  const normalizedPath = normalizeMainRoutePath(pathname);
  if (normalizedPath === '/app/locations' || normalizedPath.startsWith('/app/locations/')) {
    return '/app/dashboard';
  }

  return null;
};
