/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { useTranslation } from './i18n';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import Home from './pages/Home';
import Locations from './pages/Locations';
import FieldsBedsHierarchy from './pages/FieldsBedsHierarchy';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import Tasks from './pages/Tasks';
import GanttChart from './pages/GanttChart';
import './App.css';

/**
 * Inner component that uses navigation hooks.
 * Separated to use React Router hooks inside Router context.
 */
function AppContent(): React.ReactElement {
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
          <NavLink to="/tasks" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('tasks')}
          </NavLink>
          <NavLink to="/gantt-chart" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('ganttChart')}
          </NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/fields-beds" element={<FieldsBedsHierarchy />} />
        <Route path="/cultures" element={<Cultures />} />
        <Route path="/planting-plans" element={<PlantingPlans />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/gantt-chart" element={<GanttChart />} />
      </Routes>
    </div>
  );
}

function App(): React.ReactElement {
  // Use Vite's base URL to set React Router basename so routes work under a subdirectory
  // Vite provides BASE_URL ending with a trailing slash (e.g., "/openfarmplanner/")
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <Router basename={basename}>
      <AppContent />
    </Router>
  );
}

export default App;

