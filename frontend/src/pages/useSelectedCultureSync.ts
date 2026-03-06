import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  SELECTED_CULTURE_STORAGE_KEY,
  getStoredCultureId,
  parseCultureId,
} from './culturesPageUtils';

type SelectionSyncSource = 'internal' | 'query' | null;

type UseSelectedCultureSyncResult = {
  selectedCultureId: number | undefined;
  updateSelectedCultureId: (id: number | undefined, source: Exclude<SelectionSyncSource, null>) => void;
};

export function useSelectedCultureSync(): UseSelectedCultureSyncResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCultureParam = searchParams.get('cultureId');
  const selectedCultureIdFromQuery = parseCultureId(selectedCultureParam);

  const selectionSyncSourceRef = useRef<SelectionSyncSource>(null);
  const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(() => {
    if (Number.isFinite(selectedCultureIdFromQuery)) {
      return selectedCultureIdFromQuery;
    }

    return getStoredCultureId();
  });

  const updateSelectedCultureId = useCallback((id: number | undefined, source: Exclude<SelectionSyncSource, null>) => {
    selectionSyncSourceRef.current = source;
    setSelectedCultureId((currentId) => (currentId === id ? currentId : id));
  }, []);

  useEffect(() => {
    if (selectionSyncSourceRef.current === 'internal') {
      return;
    }

    if (selectedCultureParam === null) {
      return;
    }

    if (selectedCultureIdFromQuery !== selectedCultureId) {
      const timeoutId = window.setTimeout(() => {
        updateSelectedCultureId(selectedCultureIdFromQuery, 'query');
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [selectedCultureIdFromQuery, selectedCultureId, selectedCultureParam, updateSelectedCultureId]);

  useEffect(() => {
    if (selectedCultureId === undefined) {
      localStorage.removeItem(SELECTED_CULTURE_STORAGE_KEY);

      if (selectionSyncSourceRef.current === 'query') {
        selectionSyncSourceRef.current = null;
        return;
      }

      if (!selectedCultureParam) {
        selectionSyncSourceRef.current = null;
        return;
      }

      setSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete('cultureId');
        return nextParams;
      }, { replace: true });
      selectionSyncSourceRef.current = null;
      return;
    }

    localStorage.setItem(SELECTED_CULTURE_STORAGE_KEY, String(selectedCultureId));

    if (selectionSyncSourceRef.current === 'query') {
      selectionSyncSourceRef.current = null;
      return;
    }

    if (selectedCultureParam === String(selectedCultureId)) {
      selectionSyncSourceRef.current = null;
      return;
    }

    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set('cultureId', String(selectedCultureId));
      return nextParams;
    }, { replace: true });
    selectionSyncSourceRef.current = null;
  }, [selectedCultureId, selectedCultureParam, setSearchParams]);

  return {
    selectedCultureId,
    updateSelectedCultureId,
  };
}
