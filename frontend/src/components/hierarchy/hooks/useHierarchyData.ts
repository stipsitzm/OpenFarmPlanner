/**
 * Custom hook for managing hierarchical data fetching
 */

import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from '../../../i18n';
import { locationAPI, fieldAPI, bedAPI, type Location, type Field, type Bed } from '../../../api/api';

export interface HierarchyDataState {
  loading: boolean;
  hasLoaded: boolean;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  locations: Location[];
  setLocations: Dispatch<SetStateAction<Location[]>>;
  fields: Field[];
  setFields: Dispatch<SetStateAction<Field[]>>;
  beds: Bed[];
  setBeds: Dispatch<SetStateAction<Bed[]>>;
  fetchData: () => Promise<void>;
}

export function useHierarchyData(enabled = true): HierarchyDataState {
  const { t } = useTranslation('hierarchy');
  const [loading, setLoading] = useState<boolean>(enabled);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    if (!enabled) {
      return;
    }
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
      setHasLoaded(true);
      setLoading(false);
    }
  }, [enabled, t]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setHasLoaded(false);
      setError('');
      setLocations([]);
      setFields([]);
      setBeds([]);
      return;
    }

    void fetchData();
  }, [enabled, fetchData]);

  return {
    loading,
    hasLoaded,
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
