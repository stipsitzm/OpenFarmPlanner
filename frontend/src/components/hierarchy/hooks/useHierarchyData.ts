/**
 * Custom hook for managing hierarchical data fetching
 */

import { useState, useCallback, useEffect } from 'react';
import { locationAPI, fieldAPI, bedAPI, type Location, type Field, type Bed } from '../../../api/api';

export function useHierarchyData() {
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
      
      setLocations(locationsRes.data.results.filter(l => l.id !== undefined));
      setFields(fieldsRes.data.results.filter(f => f.id !== undefined));
      setBeds(bedsRes.data.results.filter(b => b.id !== undefined));
      setError('');
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    error,
    setError,
    locations,
    fields,
    beds,
    setBeds,
    setFields,
    fetchData,
  };
}
