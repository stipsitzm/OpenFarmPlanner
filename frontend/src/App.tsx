/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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
          <Link to="/" className="nav-link home">
            {t('home')}
          </Link>
          <Link to="/locations" className="nav-link">
            {t('locations')}
          </Link>
          <Link to="/fields-beds" className="nav-link">
            {t('fieldsAndBeds')}
          </Link>
          <Link to="/cultures" className="nav-link">
            {t('cultures')}
          </Link>
          <Link to="/planting-plans" className="nav-link">
            {t('plantingPlans')}
          </Link>
          <Link to="/tasks" className="nav-link">
            {t('tasks')}
          </Link>
          <Link to="/gantt-chart" className="nav-link">
            {t('ganttChart')}
          </Link>
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
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

