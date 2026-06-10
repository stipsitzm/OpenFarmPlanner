/**
 * Custom hook for managing hierarchical data fetching
 */

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from '../../../i18n';
import { locationAPI, fieldAPI, bedAPI, type Location, type Field, type Bed } from '../../../api/api';

type HierarchyEntity = {
  id?: number | null;
};

interface FetchDataOptions {
  showLoading?: boolean;
}

const hasTemporaryEntityId = (entity: HierarchyEntity): boolean =>
  typeof entity.id === 'number' && entity.id < 0;

const mergePersistedWithTemporaryEntities = <T extends HierarchyEntity>(
  persistedEntities: T[],
  currentEntities: T[],
): T[] => {
  const temporaryEntities = currentEntities.filter(hasTemporaryEntityId);
  return [...temporaryEntities, ...persistedEntities];
};

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
  fetchData: (options?: FetchDataOptions) => Promise<void>;
}

export function useHierarchyData(enabled = true): HierarchyDataState {
  const { t } = useTranslation('hierarchy');
  const [loading, setLoading] = useState<boolean>(enabled);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const latestFetchRequestRef = useRef(0);

  const fetchData = useCallback(async (options: FetchDataOptions = {}): Promise<void> => {
    if (!enabled) {
      return;
    }
    const { showLoading = true } = options;
    const fetchRequestId = latestFetchRequestRef.current + 1;
    latestFetchRequestRef.current = fetchRequestId;
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [locationsRes, fieldsRes, bedsRes] = await Promise.all([
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
      ]);

      if (fetchRequestId !== latestFetchRequestRef.current) {
        return;
      }
      
      const locs = locationsRes.data.results.filter(l => l.id !== undefined);
      const flds = fieldsRes.data.results.filter(f => f.id !== undefined);
      const bds = bedsRes.data.results.filter(b => b.id !== undefined);
      setLocations((currentLocations) =>
        mergePersistedWithTemporaryEntities(locs, currentLocations),
      );
      setFields((currentFields) =>
        mergePersistedWithTemporaryEntities(flds, currentFields),
      );
      setBeds((currentBeds) =>
        mergePersistedWithTemporaryEntities(bds, currentBeds),
      );
      setError('');
    } catch (err) {
      if (fetchRequestId !== latestFetchRequestRef.current) {
        return;
      }
      setError(t('errors.load'));
      console.error('Error fetching data:', err);
    } finally {
      if (fetchRequestId !== latestFetchRequestRef.current) {
        return;
      }
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
