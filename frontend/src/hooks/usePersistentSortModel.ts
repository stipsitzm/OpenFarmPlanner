import { useCallback, useMemo, useState } from 'react';
import type { GridSortModel, GridSortDirection } from '@mui/x-data-grid';

interface UsePersistentSortModelOptions {
  tableKey: string;
  defaultSortModel?: GridSortModel;
  allowedFields?: string[];
  persistInUrl?: boolean;
}

const STORAGE_PREFIX = 'tableSort.';

const normalizeSortDirection = (direction: string | null): GridSortDirection | null => {
  if (direction === 'asc' || direction === 'desc') {
    return direction;
  }
  return null;
};

const isValidField = (field: string | null, allowedFields?: string[]): field is string => {
  if (!field) {
    return false;
  }

  if (!allowedFields || allowedFields.length === 0) {
    return true;
  }

  return allowedFields.includes(field);
};

const getUrlParamKeys = (tableKey: string): { field: string; direction: string } => ({
  field: `sort_${tableKey}`,
  direction: `dir_${tableKey}`,
});

const getSortModelFromUrl = (tableKey: string, allowedFields?: string[]): GridSortModel | null => {
  const { field, direction } = getUrlParamKeys(tableKey);
  const searchParams = new URLSearchParams(window.location.search);
  const sortField = searchParams.get(field);
  const sortDirection = normalizeSortDirection(searchParams.get(direction));

  if (!isValidField(sortField, allowedFields) || !sortDirection) {
    return null;
  }

  return [{ field: sortField, sort: sortDirection }];
};

const getSortModelFromStorage = (tableKey: string, allowedFields?: string[]): GridSortModel | null => {
  const rawData = window.sessionStorage.getItem(`${STORAGE_PREFIX}${tableKey}`);
  if (!rawData) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawData) as GridSortModel;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const [firstSort] = parsed;
    if (!firstSort) {
      return null;
    }

    if (!isValidField(firstSort.field, allowedFields) || !normalizeSortDirection(firstSort.sort ?? null)) {
      return null;
    }

    return [
      {
        field: firstSort.field,
        sort: firstSort.sort,
      },
    ];
  } catch {
    return null;
  }
};

export function usePersistentSortModel({
  tableKey,
  defaultSortModel = [],
  allowedFields,
  persistInUrl = true,
}: UsePersistentSortModelOptions): {
  sortModel: GridSortModel;
  setSortModel: (model: GridSortModel) => void;
} {
  const initialSortModel = useMemo(() => {
    const urlSortModel = persistInUrl ? getSortModelFromUrl(tableKey, allowedFields) : null;
    if (urlSortModel) {
      return urlSortModel;
    }

    const storageSortModel = getSortModelFromStorage(tableKey, allowedFields);
    if (storageSortModel) {
      return storageSortModel;
    }

    return defaultSortModel;
  }, [allowedFields, defaultSortModel, persistInUrl, tableKey]);

  const [sortModel, setSortModelState] = useState<GridSortModel>(initialSortModel);

  const setSortModel = useCallback((model: GridSortModel) => {
    const nextModel = model.length > 0 ? [model[0]] : [];

    setSortModelState(nextModel);
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${tableKey}`, JSON.stringify(nextModel));

    if (!persistInUrl) {
      return;
    }

    const { field, direction } = getUrlParamKeys(tableKey);
    const searchParams = new URLSearchParams(window.location.search);

    if (nextModel.length === 0 || !nextModel[0].sort) {
      searchParams.delete(field);
      searchParams.delete(direction);
    } else {
      searchParams.set(field, nextModel[0].field);
      searchParams.set(direction, nextModel[0].sort);
    }

    const newSearch = searchParams.toString();
    const nextUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [persistInUrl, tableKey]);

  return {
    sortModel,
    setSortModel,
  };
}
