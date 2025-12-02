import { Link } from 'react-router-dom';

function Home() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>CSA Farm Planner</h1>
      <p>Welcome to the CSA Farm Planning Tool</p>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Quick Links</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '10px' }}>
            <Link to="/cultures" style={{ fontSize: '18px', color: '#0066cc' }}>
              Manage Cultures
            </Link>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <Link to="/beds" style={{ fontSize: '18px', color: '#0066cc' }}>
              Manage Beds
            </Link>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <Link to="/planting-plans" style={{ fontSize: '18px', color: '#0066cc' }}>
              Manage Planting Plans
            </Link>
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
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
