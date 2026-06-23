import { useState, useRef, useCallback, type ChangeEvent } from 'react';
import { cultureAPI, type Culture } from '../api/api';
import { useTranslation } from '../i18n';
import {
  buildAllCulturesExport,
  buildAllCulturesFilename,
  buildSingleCultureExport,
  buildSingleCultureFilename,
  downloadJsonFile,
} from '../cultures/exportUtils';
import { buildImportSuccessMessage, mapImportErrors } from './culturesPageUtils';
import { analyzeCultureImportJson, readFileAsText } from './culturesImportUtils';
import { useCultureImportState } from './useCultureImportState';

interface UseCultureImportExportConfig {
  selectedCulture: Culture | undefined;
  fetchCultures: () => Promise<void>;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info') => void;
}

export function useCultureImportExport({
  selectedCulture,
  fetchCultures,
  showSnackbar,
}: UseCultureImportExportConfig) {
  const { t } = useTranslation(['cultures', 'common']);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [confirmUpdates, setConfirmUpdates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    state: importState,
    hasImportableEntries,
    reset: resetImportState,
    setErrorState: setImportErrorState,
    setPreviewReadyState,
    setUploading: setImportUploading,
    setPartialFailure: setImportPartialFailure,
    setSuccessState: setImportSuccessState,
  } = useCultureImportState();

  const handleImportFileTrigger = useCallback(() => {
    resetImportState();
    fileInputRef.current?.click();
  }, [resetImportState]);

  const handleExportCurrentCulture = useCallback(() => {
    if (!selectedCulture) {
      return;
    }

    const exportPayload = buildSingleCultureExport(selectedCulture);
    const filename = buildSingleCultureFilename(selectedCulture);
    downloadJsonFile(exportPayload, filename);
    showSnackbar(t('messages.exportSuccess'), 'success');
  }, [selectedCulture, showSnackbar, t]);

  const handleExportAllCultures = useCallback(async () => {
    try {
      const allCultures: Culture[] = [];
      let nextUrl: string | null = '/cultures/';

      while (nextUrl) {
        const response = await cultureAPI.list(nextUrl);
        allCultures.push(...response.data.results);
        nextUrl = response.data.next;
      }

      const exportPayload = buildAllCulturesExport(allCultures);
      const filename = buildAllCulturesFilename();
      downloadJsonFile(exportPayload, filename);
      showSnackbar(t('messages.exportSuccess'), 'success');
    } catch (error) {
      console.error('Error exporting cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    }
  }, [showSnackbar, t]);

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const jsonString = await readFileAsText(file);
      const importAnalysis = analyzeCultureImportJson(jsonString, t);

      if (importAnalysis.status === 'error') {
        setImportErrorState({
          error: t(importAnalysis.errorKey),
          previewCount: importAnalysis.originalCount,
          validCount: 0,
          invalidEntries: importAnalysis.invalidEntries,
        });
        setImportDialogOpen(true);
        return;
      }

      setImportUploading();
      try {
        const response = await cultureAPI.importPreview(importAnalysis.validEntries);

        setPreviewReadyState({
          previewCount: importAnalysis.originalCount,
          validCount: importAnalysis.validEntries.length,
          invalidEntries: importAnalysis.invalidEntries,
          payload: importAnalysis.validEntries,
          previewResults: response.data.results,
        });
        setImportDialogOpen(true);
      } catch (error) {
        console.error('Error calling preview endpoint:', error);
        setImportErrorState({ error: t('import.errors.network') });
        setImportDialogOpen(true);
      }
    } catch (error) {
      console.error('Error reading JSON file:', error);
      setImportErrorState({ error: t('import.errors.parse') });
      setImportDialogOpen(true);
    }
  };

  const handleImportStart = async () => {
    if (!hasImportableEntries || importState.status === 'uploading') {
      return;
    }

    setImportUploading();

    try {
      const response = await cultureAPI.importApply({
        items: importState.payload,
        confirm_updates: confirmUpdates,
      });

      const { created_count, updated_count, skipped_count, errors } = response.data;

      if (errors.length > 0) {
        setImportPartialFailure({
          failedEntries: mapImportErrors(errors, importState.payload),
          error: t('import.errors.someFailures', {
            failed: errors.length,
          }),
        });
        return;
      }

      const successMessage = buildImportSuccessMessage(created_count, updated_count, skipped_count, t);

      setImportSuccessState(successMessage || t('import.success'));
      await fetchCultures();
    } catch (error) {
      console.error('Error importing cultures:', error);
      setImportErrorState({ error: t('import.errors.network') });
    }
  };

  const handleImportDialogClose = () => {
    setImportDialogOpen(false);
  };

  return {
    importDialogOpen,
    fileInputRef,
    importState,
    hasImportableEntries,
    confirmUpdates,
    setConfirmUpdates,
    handleImportFileTrigger,
    handleExportCurrentCulture,
    handleExportAllCultures,
    handleImportFileChange,
    handleImportStart,
    handleImportDialogClose,
  };
}
