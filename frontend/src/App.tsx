/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, RouterProvider, Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from './i18n';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useRegisterCommands } from './commands/CommandProvider';
import type { CommandSpec } from './commands/types';
import Home from './pages/Home';
import Locations from './pages/Locations';
import FieldsBedsHierarchy from './pages/FieldsBedsHierarchy';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import GanttChart from './pages/GanttChart';
import SeedDemandPage from './pages/SeedDemand';
import './App.css';

interface NavigationItem {
  path: string;
  label: string;
  shortcut: string;
  keywords: string[];
}

/**
 * Root layout component with navigation.
 * Wraps all routes with the persistent navigation bar.
 */
function RootLayout(): React.ReactElement {
  const { t } = useTranslation('navigation');
  const navigate = useNavigate();

  // Re-enable Ctrl+Shift+Arrow route switching
  useKeyboardNavigation();

  const navigationItems = useMemo<NavigationItem[]>(() => ([
    { path: '/', label: t('home'), shortcut: 'Alt+Shift+H', keywords: ['start', 'home'] },
    { path: '/locations', label: t('locations'), shortcut: 'Alt+Shift+L', keywords: ['standorte', 'locations'] },
    { path: '/fields-beds', label: t('fieldsAndBeds'), shortcut: 'Alt+Shift+F', keywords: ['flächen', 'beete', 'fields'] },
    { path: '/cultures', label: t('cultures'), shortcut: 'Alt+Shift+C', keywords: ['kulturen', 'cultures'] },
    { path: '/planting-plans', label: t('plantingPlans'), shortcut: 'Alt+Shift+P', keywords: ['anbaupläne', 'planung'] },
    { path: '/gantt-chart', label: t('ganttChart'), shortcut: 'Alt+Shift+G', keywords: ['gantt', 'zeitplan'] },
    { path: '/seed-demand', label: t('seedDemand'), shortcut: 'Alt+Shift+S', keywords: ['saatgut', 'bedarf'] },
  ]), [t]);

  const navigationCommands = useMemo<CommandSpec[]>(() => navigationItems.map((item) => ({
    id: `navigation.${item.path || 'home'}`,
    title: `${item.label} (${item.shortcut})`,
    keywords: ['navigation', ...item.keywords],
    shortcutHint: item.shortcut,
    keys: {
      alt: true,
      shift: true,
      key: item.shortcut.split('+').at(-1) ?? '',
    },
    contextTags: [],
    isAvailable: () => true,
    run: () => navigate(item.path),
  })), [navigate, navigationItems]);

  useRegisterCommands('global-navigation', navigationCommands);
  
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-links">
          {navigationItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={index === 0}
              title={`${item.label} (${item.shortcut})`}
              aria-label={`${item.label} (${item.shortcut})`}
              className={({ isActive }) => {
                const baseClass = index === 0 ? 'nav-link home' : 'nav-link';
                return isActive ? `${baseClass} active` : baseClass;
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}

/**
 * Create the router with data router API
 */
function createAppRouter(basename: string) {
  return createBrowserRouter([
    {
      path: '/',
      element: <RootLayout />,
      children: [
        {
          index: true,
          element: <Home />,
        },
        {
          path: 'locations',
          element: <Locations />,
        },
        {
          path: 'fields-beds',
          element: <FieldsBedsHierarchy />,
        },
        {
          path: 'cultures',
          element: <Cultures />,
        },
        {
          path: 'planting-plans',
          element: <PlantingPlans />,
        },
        {
          path: 'gantt-chart',
          element: <GanttChart />,
        },
        {
          path: 'seed-demand',
          element: <SeedDemandPage />,
        },
      ],
    },
  ], {
    basename,
  });
}

function App(): React.ReactElement {
  // Use Vite's base URL to set React Router basename so routes work under a subdirectory
  // Vite provides BASE_URL ending with a trailing slash (e.g., "/openfarmplanner/")
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  
  const router = createAppRouter(basename);
  
  return <RouterProvider router={router} />;
}

export default App;
