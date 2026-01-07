/**
 * Cultures (Kulturen) page component.
 * 
 * Displays crop culture details with searchable dropdown.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { cultureAPI, type Culture } from '../api/api';
import { CultureDetail } from '../components/CultureDetail';

function Cultures(): React.ReactElement {
  const { t } = useTranslation('cultures');
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(undefined);

  // Fetch cultures on mount
  useEffect(() => {
    const fetchCultures = async () => {
      try {
        const response = await cultureAPI.list();
        setCultures(response.data.results);
      } catch (error) {
        console.error('Error fetching cultures:', error);
      }
    };

    fetchCultures();
  }, []);

  const handleCultureSelect = (culture: Culture | null) => {
    setSelectedCultureId(culture?.id);
  };

  return (
    <div className="page-container">
      <h1>{t('title')}</h1>
      
      <CultureDetail
        cultures={cultures}
        selectedCultureId={selectedCultureId}
        onCultureSelect={handleCultureSelect}
      />
    </div>
  );
}

export default Cultures;
