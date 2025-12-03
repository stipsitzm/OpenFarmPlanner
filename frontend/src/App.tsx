/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for the CSA Farm Planner.
 * Uses React Router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Locations from './pages/Locations';
import Fields from './pages/Fields';
import Beds from './pages/Beds';
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
            <Link to="/fields" className="nav-link">
              Schläge
            </Link>
            <Link to="/beds" className="nav-link">
              Beete
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
          <Route path="/fields" element={<Fields />} />
          <Route path="/beds" element={<Beds />} />
          <Route path="/cultures" element={<Cultures />} />
          <Route path="/planting-plans" element={<PlantingPlans />} />
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

