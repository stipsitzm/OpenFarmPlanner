/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for TinyFarm.
 * Uses React Router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Locations from './pages/Locations';
import FieldsBedsHierarchy from './pages/FieldsBedsHierarchy';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import Tasks from './pages/Tasks';
import './App.css';

function App(): React.ReactElement {
  return (
    <Router>
      <div className="app">
        <nav className="nav">
          <div className="nav-links">
            <Link to="/" className="nav-link home">
              Start
            </Link>
            <Link to="/locations" className="nav-link">
              Standorte
            </Link>
            <Link to="/fields-beds" className="nav-link">
              Schläge & Beete
            </Link>
            <Link to="/cultures" className="nav-link">
              Kulturen
            </Link>
            <Link to="/planting-plans" className="nav-link">
              Anbaupläne
            </Link>
            <Link to="/tasks" className="nav-link">
              Aufgaben
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

