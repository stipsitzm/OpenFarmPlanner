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
        <nav style={{ 
          padding: '10px 20px', 
          backgroundColor: '#333', 
          color: 'white',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>
              Home
            </Link>
            <Link to="/cultures" style={{ color: 'white', textDecoration: 'none' }}>
              Cultures
            </Link>
            <Link to="/beds" style={{ color: 'white', textDecoration: 'none' }}>
              Beds
            </Link>
            <Link to="/planting-plans" style={{ color: 'white', textDecoration: 'none' }}>
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

