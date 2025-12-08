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
import Home from './pages/Home';
import Locations from './pages/Locations';
import FieldsBedsHierarchy from './pages/FieldsBedsHierarchy';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import Tasks from './pages/Tasks';
import './App.css';

function App(): React.ReactElement {
  const { t } = useTranslation('navigation');
  
  return (
    <Router>
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
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/fields-beds" element={<FieldsBedsHierarchy />} />
          <Route path="/cultures" element={<Cultures />} />
          <Route path="/planting-plans" element={<PlantingPlans />} />
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

