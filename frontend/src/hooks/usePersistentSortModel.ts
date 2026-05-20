import { useCallback, useMemo, useState } from 'react';
import type { GridFilterModel, GridSortDirection, GridSortModel } from '@mui/x-data-grid';

interface UsePersistentSortModelOptions {
  tableKey: string;
  defaultSortModel?: GridSortModel;
  allowedFields?: string[];
  persistInUrl?: boolean;
}

const SORT_STORAGE_PREFIX = 'tableSort.';
const FILTER_STORAGE_PREFIX = 'tableFilter.';
const EMPTY_FILTER_MODEL: GridFilterModel = { items: [] };

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

const getFilterUrlParamKey = (tableKey: string): string => `filter_${tableKey}`;

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
  const rawData = window.sessionStorage.getItem(`${SORT_STORAGE_PREFIX}${tableKey}`);
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

const normalizeFilterModel = (
  model: GridFilterModel | null | undefined,
  allowedFields?: string[],
): GridFilterModel => {
  if (!model || !Array.isArray(model.items)) {
    return EMPTY_FILTER_MODEL;
  }

  const items = model.items.filter((item) => isValidField(item.field, allowedFields));
  const nextModel: GridFilterModel = { items };

  if (model.logicOperator) {
    nextModel.logicOperator = model.logicOperator;
  }
  if (model.quickFilterLogicOperator) {
    nextModel.quickFilterLogicOperator = model.quickFilterLogicOperator;
  }
  if (typeof model.quickFilterExcludeHiddenColumns === 'boolean') {
    nextModel.quickFilterExcludeHiddenColumns = model.quickFilterExcludeHiddenColumns;
  }
  if (Array.isArray(model.quickFilterValues) && model.quickFilterValues.length > 0) {
    nextModel.quickFilterValues = model.quickFilterValues;
  }

  return nextModel;
};

const hasActiveFilters = (model: GridFilterModel): boolean =>
  model.items.length > 0 || Boolean(model.quickFilterValues && model.quickFilterValues.length > 0);

const getFilterModelFromUrl = (tableKey: string, allowedFields?: string[]): GridFilterModel | null => {
  const searchParams = new URLSearchParams(window.location.search);
  const rawData = searchParams.get(getFilterUrlParamKey(tableKey));
  if (!rawData) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawData) as GridFilterModel;
    const normalized = normalizeFilterModel(parsed, allowedFields);
    return hasActiveFilters(normalized) ? normalized : null;
  } catch {
    return null;
  }
};

const getFilterModelFromStorage = (tableKey: string, allowedFields?: string[]): GridFilterModel | null => {
  const rawData = window.sessionStorage.getItem(`${FILTER_STORAGE_PREFIX}${tableKey}`);
  if (!rawData) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawData) as GridFilterModel;
    const normalized = normalizeFilterModel(parsed, allowedFields);
    return hasActiveFilters(normalized) ? normalized : null;
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
  filterModel: GridFilterModel;
  setFilterModel: (model: GridFilterModel) => void;
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

  const initialFilterModel = useMemo(() => {
    const urlFilterModel = persistInUrl ? getFilterModelFromUrl(tableKey, allowedFields) : null;
    if (urlFilterModel) {
      return urlFilterModel;
    }

    const storageFilterModel = getFilterModelFromStorage(tableKey, allowedFields);
    if (storageFilterModel) {
      return storageFilterModel;
    }

    return EMPTY_FILTER_MODEL;
  }, [allowedFields, persistInUrl, tableKey]);

  const [sortModel, setSortModelState] = useState<GridSortModel>(initialSortModel);
  const [filterModel, setFilterModelState] = useState<GridFilterModel>(initialFilterModel);

  const setSortModel = useCallback((model: GridSortModel) => {
    const nextModel = model.length > 0 ? [model[0]] : [];

    setSortModelState(nextModel);
    window.sessionStorage.setItem(`${SORT_STORAGE_PREFIX}${tableKey}`, JSON.stringify(nextModel));

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
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) {
      return;
    }

    window.history.replaceState(window.history.state, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, [persistInUrl, tableKey]);

  const setFilterModel = useCallback((model: GridFilterModel) => {
    const nextModel = normalizeFilterModel(model, allowedFields);
    const nextSerializedModel = JSON.stringify(nextModel);

    setFilterModelState((previousModel) =>
      JSON.stringify(previousModel) === nextSerializedModel ? previousModel : nextModel,
    );
    window.sessionStorage.setItem(`${FILTER_STORAGE_PREFIX}${tableKey}`, nextSerializedModel);

    if (!persistInUrl) {
      return;
    }

    const filter = getFilterUrlParamKey(tableKey);
    const searchParams = new URLSearchParams(window.location.search);

    if (hasActiveFilters(nextModel)) {
      searchParams.set(filter, nextSerializedModel);
    } else {
      searchParams.delete(filter);
    }

    const newSearch = searchParams.toString();
    const nextUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) {
      return;
    }

    window.history.replaceState(window.history.state, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, [allowedFields, persistInUrl, tableKey]);

  return {
    sortModel,
    setSortModel,
    filterModel,
    setFilterModel,
  };
}
