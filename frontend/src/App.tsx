/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, RouterProvider, Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useTranslation } from './i18n';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useRegisterCommands } from './commands/CommandProvider';
import type { CommandSpec } from './commands/types';
import { useMemo, useState } from 'react';
import Home from './pages/Home';
import Locations from './pages/Locations';
import FieldsBedsHierarchy from './pages/FieldsBedsHierarchy';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import GanttChart from './pages/GanttChart';
import SeedDemandPage from './pages/SeedDemand';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import './App.css';


/**
 * Root layout component with navigation.
 * Wraps all routes with the persistent navigation bar.
 */
function RootLayout(): React.ReactElement {
  const { t } = useTranslation('navigation');
  // Re-enable Ctrl+Shift+Arrow route switching
  useKeyboardNavigation();

  const navigate = useNavigate();
  const location = useLocation();
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<null | HTMLElement>(null);
  const routes = ['/', '/locations', '/fields-beds', '/cultures', '/planting-plans', '/gantt-chart', '/seed-demand'];

  const handleGlobalMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setGlobalMenuAnchor(event.currentTarget);
  };

  const handleGlobalMenuClose = () => {
    setGlobalMenuAnchor(null);
  };

  const navigateToCulturesAction = (action: 'project-history' | 'shortcuts') => {
    const nonce = Date.now().toString();
    navigate(`/cultures?navAction=${action}&navActionNonce=${nonce}`);
    handleGlobalMenuClose();
  };

  const globalCommands = useMemo<CommandSpec[]>(() => [
    {
      id: 'global.nextPage',
      title: 'Nächste Seite (Ctrl+Shift+→)',
      keywords: ['seite', 'nächste', 'navigation'],
      shortcutHint: 'Ctrl+Shift+→',
      contextTags: ['global'],
      isAvailable: () => true,
      run: () => {
        const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
        const currentIndex = routes.indexOf(normalizedPath);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % routes.length;
        navigate(routes[nextIndex]);
      },
    },
    {
      id: 'global.previousPage',
      title: 'Vorherige Seite (Ctrl+Shift+←)',
      keywords: ['seite', 'vorherige', 'navigation'],
      shortcutHint: 'Ctrl+Shift+←',
      contextTags: ['global'],
      isAvailable: () => true,
      run: () => {
        const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
        const currentIndex = routes.indexOf(normalizedPath);
        const previousIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + routes.length) % routes.length;
        navigate(routes[previousIndex]);
      },
    },
  ], [location.pathname, navigate]);

  useRegisterCommands('global-app', globalCommands);
  
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link home active" : "nav-link home"}>
            {t('home')}
          </NavLink>
          <NavLink to="/locations" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('locations')}
          </NavLink>
          <NavLink to="/fields-beds" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('fieldsAndBeds')}
          </NavLink>
          <NavLink to="/cultures" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('cultures')}
          </NavLink>
          <NavLink to="/planting-plans" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('plantingPlans')}
          </NavLink>
          <NavLink to="/gantt-chart" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('ganttChart')}
          </NavLink>
          <NavLink to="/seed-demand" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('seedDemand')}
          </NavLink>
        </div>
        <div className="nav-actions">
          <IconButton
            aria-label="Mehr"
            aria-controls={globalMenuAnchor ? 'global-actions-menu' : undefined}
            aria-haspopup="true"
            onClick={handleGlobalMenuOpen}
            size="small"
            sx={{ color: 'white' }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            id="global-actions-menu"
            anchorEl={globalMenuAnchor}
            open={Boolean(globalMenuAnchor)}
            onClose={handleGlobalMenuClose}
          >
            <MenuItem onClick={() => navigateToCulturesAction('project-history')}>
              Projekt-History…
            </MenuItem>
            <MenuItem onClick={() => navigateToCulturesAction('shortcuts')}>
              Tastenkürzel
            </MenuItem>
          </Menu>
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
