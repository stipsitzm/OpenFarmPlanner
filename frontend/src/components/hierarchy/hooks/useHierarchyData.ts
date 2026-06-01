/**
 * Custom hook for managing hierarchical data fetching
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from '../../../i18n';
import { locationAPI, fieldAPI, bedAPI, type Location, type Field, type Bed } from '../../../api/api';

export function useHierarchyData() {
  const { t } = useTranslation('hierarchy');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [locationsRes, fieldsRes, bedsRes] = await Promise.all([
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
      ]);
      
      const locs = locationsRes.data.results.filter(l => l.id !== undefined);
      const flds = fieldsRes.data.results.filter(f => f.id !== undefined);
      const bds = bedsRes.data.results.filter(b => b.id !== undefined);
      setLocations(locs);
      setFields(flds);
      setBeds(bds);
      setError('');
      console.debug('[DEBUG] useHierarchyData.fetchData: locations', locs);
      console.debug('[DEBUG] useHierarchyData.fetchData: fields', flds);
      console.debug('[DEBUG] useHierarchyData.fetchData: beds', bds);
    } catch (err) {
      setError(t('errors.load'));
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    setError,
    locations,
    setLocations,
    fields,
    beds,
    setBeds,
    setFields,
    fetchData,
  };
}
