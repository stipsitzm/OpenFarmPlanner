import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="page-container">
      <h1>CSA Farm Planner</h1>
      <p>Welcome to the CSA Farm Planning Tool</p>
      
      <div className="home-section">
        <h2>Quick Links</h2>
        <ul className="quick-links">
          <li>
            <Link to="/cultures" className="quick-link">
              Manage Cultures
            </Link>
          </li>
          <li>
            <Link to="/beds" className="quick-link">
              Manage Beds
            </Link>
          </li>
          <li>
            <Link to="/planting-plans" className="quick-link">
              Manage Planting Plans
            </Link>
          </li>
        </ul>
      </div>

      <div className="features-box">
        <h3>Features</h3>
        <ul>
          <li>Manage crops and plant varieties (Cultures)</li>
          <li>Organize your farm layout (Locations, Fields, Beds)</li>
          <li>Plan your planting schedule with automatic harvest date calculation</li>
          <li>Track tasks and activities</li>
        </ul>
      </div>
    </div>
  );
}

export default Home;
