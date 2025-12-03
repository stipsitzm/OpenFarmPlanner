import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Cultures from './pages/Cultures';
import Beds from './pages/Beds';
import PlantingPlans from './pages/PlantingPlans';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="nav">
          <div className="nav-links">
            <Link to="/" className="nav-link home">
              Home
            </Link>
            <Link to="/cultures" className="nav-link">
              Cultures
            </Link>
            <Link to="/beds" className="nav-link">
              Beds
            </Link>
            <Link to="/planting-plans" className="nav-link">
              Planting Plans
            </Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cultures" element={<Cultures />} />
          <Route path="/beds" element={<Beds />} />
          <Route path="/planting-plans" element={<PlantingPlans />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

