/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, RouterProvider, Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from './i18n';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import Home from './pages/Home';
import Locations from './pages/Locations';
import FieldsBedsHierarchy from './pages/FieldsBedsHierarchy';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import GanttChart from './pages/GanttChart';
import './App.css';

/**
 * Root layout component with navigation.
 * Wraps all routes with the persistent navigation bar.
 */
function RootLayout(): React.ReactElement {
  const { t } = useTranslation('navigation');
  
  // Enable keyboard navigation shortcuts
  useKeyboardNavigation();
  
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
          {/*
          </NavLink>*/}
          <NavLink to="/gantt-chart" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('ganttChart')}
          </NavLink>
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

