/**
 * Home page component.
 * 
 * Landing page for the OpenFarmPlanner application.
 * Displays quick links to main features and a feature overview.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Home page component
 */

import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';

function Home(): React.ReactElement {
  const { t } = useTranslation(['home', 'common']);
  
  return (
    <div className="page-container">
      <h1>{t('common:appName')}</h1>
      <p>{t('home:welcome')}</p>
      
      <div className="home-section">
        <h2>{t('home:quickAccess')}</h2>
        <ul className="quick-links">
          <li>
            <Link to="/locations" className="quick-link">
              {t('home:manageLocations')}
            </Link>
          </li>
          <li>
            <Link to="/fields-beds" className="quick-link">
              {t('home:manageBeds')}
            </Link>
          </li>
          <li>
            <Link to="/cultures" className="quick-link">
              {t('home:manageCultures')}
            </Link>
          </li>
          <li>
            <Link to="/planting-plans" className="quick-link">
              {t('home:managePlantingPlans')}
            </Link>
          </li>
          {/*<li>
            <Link to="/tasks" className="quick-link">
              {t('home:manageTasks')}
            </Link>
          </li>*/}
        </ul>
      </div>

      <div className="features-box">
        <h3>{t('home:features')}</h3>
        <ul>
          <li>{t('home:feature1')}</li>
          <li>{t('home:feature2')}</li>
          <li>{t('home:feature3')}</li>
          <li>{t('home:feature4')}</li>
        </ul>
      </div>
    </div>
  );
}

export default Home;
