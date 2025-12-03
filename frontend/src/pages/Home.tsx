/**
 * Home page component.
 * 
 * Landing page for the CSA Farm Planner application.
 * Displays quick links to main features and a feature overview.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Home page component
 */

import { Link } from 'react-router-dom';

function Home(): React.ReactElement {
  return (
    <div className="page-container">
      <h1>CSA Farm Planner</h1>
      <p>Willkommen beim CSA Farm Planner</p>
      
      <div className="home-section">
        <h2>Schnellzugriff</h2>
        <ul className="quick-links">
          <li>
            <Link to="/locations" className="quick-link">
              Standorte verwalten
            </Link>
          </li>
          <li>
            <Link to="/fields" className="quick-link">
              Schläge verwalten
            </Link>
          </li>
          <li>
            <Link to="/beds" className="quick-link">
              Beete verwalten
            </Link>
          </li>
          <li>
            <Link to="/cultures" className="quick-link">
              Kulturen verwalten
            </Link>
          </li>
          <li>
            <Link to="/planting-plans" className="quick-link">
              Anbaupläne verwalten
            </Link>
          </li>
          <li>
            <Link to="/tasks" className="quick-link">
              Aufgaben verwalten
            </Link>
          </li>
        </ul>
      </div>

      <div className="features-box">
        <h3>Funktionen</h3>
        <ul>
          <li>Verwalten Sie Ihre Kulturen und Pflanzensorten</li>
          <li>Organisieren Sie Ihr Hoflayout (Standorte, Schläge, Beete)</li>
          <li>Planen Sie Ihren Anbauzeitplan mit automatischer Erntedatumsberechnung</li>
          <li>Verfolgen Sie Aufgaben und Aktivitäten</li>
        </ul>
      </div>
    </div>
  );
}

export default Home;
