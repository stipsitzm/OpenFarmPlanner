import { useCallback, useMemo, useState } from 'react';
import type { ImportFailedEntry, ImportPreviewResult } from './culturesPageUtils';

type ImportStatus = 'idle' | 'ready' | 'uploading' | 'success' | 'error';

type CultureImportState = {
  previewCount: number;
  validCount: number;
  invalidEntries: string[];
  payload: Record<string, unknown>[];
  previewResults: ImportPreviewResult[];
  status: ImportStatus;
  error: string | null;
  success: string | null;
  failedEntries: ImportFailedEntry[];
};

const INITIAL_IMPORT_STATE: CultureImportState = {
  previewCount: 0,
  validCount: 0,
  invalidEntries: [],
  payload: [],
  previewResults: [],
  status: 'idle',
  error: null,
  success: null,
  failedEntries: [],
};

export const useCultureImportState = () => {
  const [state, setState] = useState<CultureImportState>(INITIAL_IMPORT_STATE);

  const reset = useCallback(() => {
    setState(INITIAL_IMPORT_STATE);
  }, []);

  const setErrorState = useCallback((params: {
    error: string;
    previewCount?: number;
    validCount?: number;
    invalidEntries?: string[];
  }) => {
    setState((prev) => ({
      ...prev,
      status: 'error',
      error: params.error,
      previewCount: params.previewCount ?? prev.previewCount,
      validCount: params.validCount ?? prev.validCount,
      invalidEntries: params.invalidEntries ?? prev.invalidEntries,
    }));
  }, []);

  const setPreviewReadyState = useCallback((params: {
    previewCount: number;
    validCount: number;
    invalidEntries: string[];
    payload: Record<string, unknown>[];
    previewResults: ImportPreviewResult[];
  }) => {
    setState((prev) => ({
      ...prev,
      status: 'ready',
      error: null,
      success: null,
      failedEntries: [],
      previewCount: params.previewCount,
      validCount: params.validCount,
      invalidEntries: params.invalidEntries,
      payload: params.payload,
      previewResults: params.previewResults,
    }));
  }, []);

  const setUploading = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'uploading',
      error: null,
      success: null,
      failedEntries: [],
    }));
  }, []);

  const setPartialFailure = useCallback((params: {
    error: string;
    failedEntries: ImportFailedEntry[];
  }) => {
    setState((prev) => ({
      ...prev,
      status: 'error',
      error: params.error,
      success: null,
      failedEntries: params.failedEntries,
    }));
  }, []);

  const setSuccessState = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      status: 'success',
      success: message,
      error: null,
      failedEntries: [],
    }));
  }, []);

  return useMemo(() => ({
    state,
    reset,
    setErrorState,
    setPreviewReadyState,
    setUploading,
    setPartialFailure,
    setSuccessState,
  }), [reset, setErrorState, setPartialFailure, setPreviewReadyState, setSuccessState, setUploading, state]);
};

export type { CultureImportState, ImportStatus };
