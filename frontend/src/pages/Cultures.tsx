/**
 * Cultures (Kulturen) page component.
 * 
 * Displays crop culture details with searchable dropdown.
 * Includes create and edit functionality for cultures.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useTranslation } from '../i18n';
import PageContainer from '../components/layout/PageContainer';
import { bedAPI, cultureAPI, fieldAPI, type Culture } from '../api/api';
import type {
  CultureHistoryEntry,
} from '../api/types';
import { CultureDetail } from '../cultures/CultureDetail';
import { CultureForm } from '../cultures/CultureForm';
import { PublicCultureLibraryDialog } from '../crops/components/PublicCultureLibraryDialog';
import {
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  Link,
  Stack,
  type SxProps,
  type Theme,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCommandContextTag, useRegisterCommands, useRegisterCreateActions } from '../commands/useCommandContext';
import {
  type SnackbarState,
} from './culturesPageUtils';
import { createCulturesCommandSpecs } from './culturesCommandSpecs';
import { buildCultureSavePayload } from './culturesSaveUtils';
import {
  formatHistoryChangeValue,
  getHistoryChangeFieldLabel,
  getHistoryEntryMeta,
  getHistoryEntryTarget,
  getHistoryEntryTitle,
  isCurrentHistoryEntry,
  type HistoryScope,
} from './culturesHistoryUtils';
import { useSelectedCultureSync } from './useSelectedCultureSync';
import { useAuth } from '../auth/useAuth';
import { usePublicCultureLibrary } from './usePublicCultureLibrary';
import { useCultureDelete } from './useCultureDelete';
import { useCultureImportExport } from './useCultureImportExport';
import { CulturesImportDialog } from './CulturesImportDialog';
import { CulturesImportStartDialog } from './CulturesImportStartDialog';
import { CulturesExportDialog } from './CulturesExportDialog';
import { AlertSnackbar } from '../components/feedback/AlertSnackbar';
import { ConfirmationDialog } from '../components/feedback/ConfirmationDialog';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { getFirstMissingCultivationPlanRequirement, getTranslatedProjectSetupAction } from './requirementFlow';
import type { RootLayoutOutletContext, TopbarContextAction } from '../navigation/topbarTypes';
import { useTopbarContextActions } from '../hooks/useTopbarContextActions';
import {
  DeleteUndoSnackbar,
} from '../components/data-grid';

const PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_CONTAINER_SX: SxProps<Theme> = {
  backgroundColor: 'rgba(76, 175, 80, 0.06)',
  borderLeft: '3px solid',
  borderLeftColor: 'success.main',
  py: 1.25,
  px: 1.5,
};

const PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_TITLE_SX: SxProps<Theme> = {
  fontWeight: 500,
};

function Cultures() {
  const { t } = useTranslation(['cultures', 'common']);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const { selectedCultureId, updateSelectedCultureId } = useSelectedCultureSync();
  const fallbackHistoryActorLabel = user?.display_label || user?.display_name || user?.email || undefined;

  const [cultures, setCultures] = useState<Culture[]>([]);
  const [isCulturesLoading, setIsCulturesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<CultureHistoryEntry[]>([]);
  const [historyScope, setHistoryScope] = useState<HistoryScope>('culture');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);
  const [hasFields, setHasFields] = useState(false);
  const [hasBeds, setHasBeds] = useState(false);
  const selectedCulture = cultures.find((culture) => culture.id === selectedCultureId);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const {
    deleteDialogCulture,
    setDeleteDialogCulture,
    pendingCultureDeletions,
    handleDelete,
    handleDeleteConfirm,
    undoPendingCultureDeletion,
    closePendingCultureDeletionSnackbar,
  } = useCultureDelete({
    cultures,
    setCultures,
    selectedCultureId,
    updateSelectedCultureId,
    showSnackbar,
  });

  const replaceSavedCulture = useCallback((savedCulture: Culture): void => {
    setCultures((currentCultures) => {
      const savedCultureId = savedCulture.id;
      if (savedCultureId === undefined) {
        return currentCultures;
      }

      const cultureExists = currentCultures.some((culture) => culture.id === savedCultureId);
      if (!cultureExists) {
        return [...currentCultures, savedCulture];
      }

      return currentCultures.map((culture) => (
        culture.id === savedCultureId ? savedCulture : culture
      ));
    });
  }, []);

  const fetchCultures = useCallback(async (preservedCulture?: Culture) => {
    setIsCulturesLoading(true);
    try {
      const response = await cultureAPI.list();
      const fetchedCultures = response.data.results;
      if (!preservedCulture?.id) {
        setCultures(fetchedCultures);
        return;
      }

      const preservedCultureId = preservedCulture.id;
      const fetchedCultureIds = new Set(fetchedCultures.map((culture) => culture.id));
      const nextCultures = fetchedCultures.map((culture) => (
        culture.id === preservedCultureId
          ? { ...culture, ...preservedCulture }
          : culture
      ));
      setCultures(
        fetchedCultureIds.has(preservedCultureId)
          ? nextCultures
          : [...nextCultures, preservedCulture],
      );
    } catch (error) {
      console.error('Error fetching cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    } finally {
      setIsCulturesLoading(false);
    }
  }, [showSnackbar, t]);

  const {
    importDialogOpen,
    importStartDialogOpen,
    exportDialogOpen,
    importState,
    hasImportableEntries,
    confirmUpdates,
    setConfirmUpdates,
    handleImportFileTrigger,
    handleImportFileSelected,
    handleExportCurrentCulture,
    handleExportAllCultures,
    handleOpenExportDialog,
    handleExport,
    handleImportStart,
    handleImportDialogClose,
    setImportStartDialogOpen,
    setExportDialogOpen,
  } = useCultureImportExport({
    selectedCulture,
    fetchCultures,
    showSnackbar,
  });

  const onPublicLibraryImportSuccess = useCallback(async (cultureId: number) => {
    await fetchCultures();
    updateSelectedCultureId(cultureId, 'internal');
  }, [fetchCultures, updateSelectedCultureId]);

  const onClearFormForLibrary = useCallback(() => {
    setShowForm(false);
    setEditingCulture(undefined);
  }, []);

  const {
    publicLibraryOpen,
    setPublicLibraryOpen,
    publicLibraryLoading,
    publicLibraryError,
    publicCultures,
    publicLibraryImportingId,
    publicLibraryInitialSelectedId,
    publicLibraryInitialQuery,
    publishingCultureId,
    isUpdatingOwnPublicCulture,
    fetchPublicCultures,
    handleOpenPublicLibrary,
    handleViewPublicLibraryMatch,
    handleImportPublicCulture,
    handlePublishCurrentCulture,
  } = usePublicCultureLibrary({
    shouldShowProjectRequiredState,
    selectedCulture,
    onImportSuccess: onPublicLibraryImportSuccess,
    onClearForm: onClearFormForLibrary,
    showSnackbar,
  });

  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  const handleRequestPublishCulture = useCallback(() => {
    if (isUpdatingOwnPublicCulture) {
      void handlePublishCurrentCulture();
      return;
    }
    setPublishConfirmOpen(true);
  }, [handlePublishCurrentCulture, isUpdatingOwnPublicCulture]);

  const handlePublishConfirm = useCallback(() => {
    setPublishConfirmOpen(false);
    void handlePublishCurrentCulture();
  }, [handlePublishCurrentCulture]);

  // Fetch cultures on mount
  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setCultures([]);
      setIsCulturesLoading(false);
      setHasFields(false);
      setHasBeds(false);
      return;
    }
    fetchCultures();
  }, [fetchCultures, shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    const fetchPlanRequirements = async (): Promise<void> => {
      try {
        const [fieldsResponse, bedsResponse] = await Promise.all([
          fieldAPI.list(),
          bedAPI.list(),
        ]);
        setHasFields(fieldsResponse.data.results.length > 0);
        setHasBeds(bedsResponse.data.results.length > 0);
      } catch {
        setHasFields(false);
        setHasBeds(false);
      }
    };
    void fetchPlanRequirements();
  }, [shouldShowProjectRequiredState]);


  useEffect(() => {
    if (cultures.length === 0) {
      return;
    }

    if (selectedCultureId === undefined && !showForm) {
      const [firstCulture] = cultures;
      if (firstCulture?.id !== undefined) {
        updateSelectedCultureId(firstCulture.id, 'internal');
      }
      return;
    }

    if (selectedCultureId !== undefined && !cultures.some((culture) => culture.id === selectedCultureId)) {
      updateSelectedCultureId(undefined, 'internal');
    }
  }, [cultures, selectedCultureId, showForm, updateSelectedCultureId]);

  const handleCultureSelect = (culture: Culture | null) => {
    updateSelectedCultureId(culture?.id, 'internal');
  };

  const handleAddNew = useCallback(() => {
    setEditingCulture(undefined);
    setShowForm(true);
  }, []);

  useEffect(() => {
    if (shouldShowProjectRequiredState || showForm) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('create') !== 'true') {
      return;
    }

    handleAddNew();
    searchParams.delete('create');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleAddNew, location.pathname, location.search, navigate, shouldShowProjectRequiredState, showForm]);

  const handleEdit = useCallback((culture: Culture) => {
    setEditingCulture(culture);
    setShowForm(true);
  }, []);

  useEffect(() => {
    if (shouldShowProjectRequiredState || showForm || !selectedCulture) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('action') !== 'edit' || searchParams.get('cultureId') !== String(selectedCulture.id)) {
      return;
    }

    handleEdit(selectedCulture);
    searchParams.delete('action');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleEdit, location.pathname, location.search, navigate, selectedCulture, shouldShowProjectRequiredState, showForm]);

  const handleOpenHistory = async () => {
    if (!selectedCulture?.id) {
      return;
    }
    const response = await cultureAPI.history(selectedCulture.id);
    if (response.data.length === 0) {
      showSnackbar(t('history.emptyState.title'), 'info');
      return;
    }
    setHistoryItems(response.data);
    setHistoryScope('culture');
    setHistoryOpen(true);
  };

  const handleRestoreVersion = async (historyId: number) => {
    try {
      if (historyScope === 'project') {
        await cultureAPI.projectRestore(historyId);
      } else if (historyScope === 'global') {
        await cultureAPI.globalRestore(historyId);
      } else {
        if (!selectedCulture?.id) return;
        await cultureAPI.restore(selectedCulture.id, historyId);
      }
      await fetchCultures();
      setHistoryOpen(false);
      showSnackbar(t('messages.restoreSuccess'), 'success');
    } catch {
      showSnackbar(t('messages.restoreError'), 'error');
    }
  };


  const handleSave = async (culture: Culture) => {
    try {
      const savePayload = buildCultureSavePayload(culture);

      let savedCulture: Culture;
      if (editingCulture) {
        const response = await cultureAPI.update(editingCulture.id!, savePayload as Culture);
        savedCulture = response.data;
        showSnackbar(t('messages.updateSuccess'), 'success');
      } else {
        const response = await cultureAPI.create(savePayload as Culture);
        savedCulture = response.data;
        showSnackbar(t('messages.createSuccess'), 'success');
        // Auto-select the newly created culture
        updateSelectedCultureId(savedCulture.id, 'internal');
      }
      replaceSavedCulture(savedCulture);
      setShowForm(false);
      setEditingCulture(undefined);
      void fetchCultures(savedCulture);
    } catch (error) {
      console.error('Error saving culture:', error);
      throw error; // Re-throw to prevent form from closing
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCulture(undefined);
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleCreatePlantingPlan = useCallback(() => {
    if (selectedCultureId) {
      navigate(`/app/planting-plans?cultureId=${selectedCultureId}`);
    }
  }, [navigate, selectedCultureId]);

  const firstMissingPlanRequirement = getFirstMissingCultivationPlanRequirement({
    hasFields,
    hasBeds,
    hasCultures: cultures.length > 0,
  });
  const firstMissingPlanAction = firstMissingPlanRequirement
    ? getTranslatedProjectSetupAction(firstMissingPlanRequirement, t)
    : null;
  const canCreatePlantingPlan = Boolean(selectedCulture) && firstMissingPlanRequirement === null;
  const planRequirementEmptyState = firstMissingPlanRequirement === 'fields'
    ? {
      title: t('buttons.createPlantingPlanMissingFieldsTitle'),
      description: t('buttons.createPlantingPlanDisabled.fields'),
    }
    : firstMissingPlanRequirement === 'beds'
      ? {
        title: t('buttons.createPlantingPlanMissingBedsTitle'),
        description: t('buttons.createPlantingPlanDisabled.beds'),
      }
      : null;
  useCommandContextTag('cultures');

  const goToRelativeCulture = useCallback((direction: 'next' | 'previous') => {
    if (!selectedCultureId || cultures.length === 0) {
      return;
    }

    const currentIndex = cultures.findIndex((culture) => culture.id === selectedCultureId);
    if (currentIndex === -1) {
      return;
    }

    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + delta + cultures.length) % cultures.length;
    updateSelectedCultureId(cultures[nextIndex]?.id, 'internal');
  }, [cultures, selectedCultureId, updateSelectedCultureId]);

  const contextActions = useMemo<TopbarContextAction[]>(() => ([
    {
      id: 'cultures-open-library',
      label: 'Kulturbibliothek öffnen',
      ariaLabel: 'Kulturbibliothek öffnen',
      onClick: () => {
        void handleOpenPublicLibrary();
      },
    },
    {
      id: 'cultures-import',
      label: t('import.menuLabel'),
      ariaLabel: t('import.menuLabel'),
      onClick: handleImportFileTrigger,
      shortcutHint: 'Alt+I',
    },
    {
      id: 'cultures-export',
      label: t('export.menuLabel'),
      ariaLabel: t('export.menuLabel'),
      onClick: handleOpenExportDialog,
      shortcutHint: 'Alt+X',
    },
  ]), [handleImportFileTrigger, handleOpenExportDialog, handleOpenPublicLibrary, t]);

  useTopbarContextActions(setTopbarContextActions, contextActions);

  const createActions = useMemo(() => [
    {
      id: 'create-culture',
      label: 'Kultur hinzufügen',
      shortcut: 'Alt+Shift+N',
      handler: handleAddNew,
    },
  ], [handleAddNew]);

  useRegisterCreateActions('cultures-page', createActions);

  const commandSpecs = useMemo(() => createCulturesCommandSpecs({
    cultures,
    focusSearch,
    goToRelativeCulture,
    handleCreatePlantingPlan,
    handleDelete,
    handleEdit,
    handleExportAllCultures,
    handleExportCurrentCulture,
    handleImportFileTrigger,
    selectedCulture,
    selectedCultureId,
  }), [
    cultures,
    focusSearch,
    goToRelativeCulture,
    handleCreatePlantingPlan,
    handleDelete,
    handleEdit,
    handleExportAllCultures,
    handleExportCurrentCulture,
    handleImportFileTrigger,
    selectedCulture,
    selectedCultureId,
  ]);

  useRegisterCommands('cultures-page', commandSpecs);




  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="xwide">
        <ProjectRequiredState reason={missingProjectReason} />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="xwide">

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <CultureDetail
          cultures={cultures}
          isLoading={isCulturesLoading}
          selectedCultureId={selectedCultureId}
          onCultureSelect={handleCultureSelect}
          searchInputRef={searchInputRef}
          onCreateCulture={handleAddNew}
          onOpenPublicLibrary={() => {
            void handleOpenPublicLibrary();
          }}
          onEditCulture={handleEdit}
          onCreatePlan={handleCreatePlantingPlan}
          onOpenHistory={handleOpenHistory}
          onPublishCulture={handleRequestPublishCulture}
          onDeleteCulture={handleDelete}
          canCreatePlan={canCreatePlantingPlan}
          isPublishingCulture={Boolean(selectedCulture && publishingCultureId === selectedCulture.id)}
          publishActionLabel={publishingCultureId === selectedCulture?.id
            ? (isUpdatingOwnPublicCulture ? t('library.updating') : t('library.publishing'))
            : (isUpdatingOwnPublicCulture
              ? t('library.updateButton')
              : t('library.publishButton'))}
        />
      </Box>
      {cultures.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {planRequirementEmptyState ? (
            <EmptyStateCard
              title={planRequirementEmptyState.title}
              description={planRequirementEmptyState.description}
              actions={firstMissingPlanAction ? [firstMissingPlanAction] : []}
              containerSx={PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_CONTAINER_SX}
              titleSx={PLANTING_PLAN_REQUIREMENT_EMPTY_STATE_TITLE_SX}
            />
          ) : null}
        </Box>
      )}

      <PublicCultureLibraryDialog
        open={publicLibraryOpen}
        loading={publicLibraryLoading}
        error={publicLibraryError}
        cultures={publicCultures}
        importingId={publicLibraryImportingId}
        initialSelectedId={publicLibraryInitialSelectedId}
        initialQuery={publicLibraryInitialQuery}
        onClose={() => setPublicLibraryOpen(false)}
        onSearch={(query) => {
          void fetchPublicCultures(query);
        }}
        onImport={(culture) => {
          void handleImportPublicCulture(culture);
        }}
      />

      <ConfirmationDialog
        open={Boolean(deleteDialogCulture)}
        fullWidth
        title={t('deleteDialog.title')}
        message={t('deleteDialog.confirmation', { name: deleteDialogCulture?.name ?? '' })}
        cancelLabel={t('common:actions.cancel')}
        confirmLabel={t('buttons.delete')}
        onCancel={() => setDeleteDialogCulture(null)}
        onConfirm={handleDeleteConfirm}
        titleSx={{ pb: 1 }}
        contentSx={{ pt: 1 }}
        messageTypographyProps={{ variant: 'body1', color: 'text.secondary' }}
        actionsSx={{ px: 3, pb: 2.5, pt: 1 }}
        cancelButtonProps={{ variant: 'outlined' }}
        confirmButtonProps={{ color: 'error', variant: 'contained' }}
      />

      <Dialog
        open={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1 }}>
          {t('library.publishConfirm.title')}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5}>
            <Typography color="text.secondary">
              {t('library.publishConfirm.intro', { name: selectedCulture?.name ?? '' })}
            </Typography>
            <Box component="ul" sx={{ mt: 0, mb: 0, pl: 3, color: 'text.secondary' }}>
              <li>{t('library.publishConfirm.published')}</li>
              <li>{t('library.publishConfirm.neverPublished')}</li>
              <li>{t('library.publishConfirm.attribution')}</li>
              <li>{t('library.publishConfirm.persistence')}</li>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t('library.publishConfirm.linkPrefix')}
              <Link component={RouterLink} to="/datenschutz" target="_blank" rel="noopener">
                {t('library.publishConfirm.privacyLinkLabel')}
              </Link>
              {t('library.publishConfirm.linkMiddle')}
              <Link component={RouterLink} to="/nutzungsbedingungen" target="_blank" rel="noopener">
                {t('library.publishConfirm.termsLinkLabel')}
              </Link>
              {t('library.publishConfirm.linkSuffix')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button variant="outlined" onClick={() => setPublishConfirmOpen(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="contained" onClick={handlePublishConfirm}>
            {t('library.publishConfirm.confirmButton')}
          </Button>
        </DialogActions>
      </Dialog>

      {showForm ? (
        <CultureForm
          culture={editingCulture}
          onSave={handleSave}
          onCancel={handleCancel}
          onViewPublicLibraryMatch={(match) => void handleViewPublicLibraryMatch(match)}
        />
      ) : null}

      <CulturesImportStartDialog
        open={importStartDialogOpen}
        onClose={() => setImportStartDialogOpen(false)}
        onFileSelected={(file) => void handleImportFileSelected(file)}
        t={t}
      />

      <CulturesImportDialog
        open={importDialogOpen}
        importState={importState}
        hasImportableEntries={hasImportableEntries}
        confirmUpdates={confirmUpdates}
        onConfirmUpdatesChange={setConfirmUpdates}
        onClose={handleImportDialogClose}
        onImportStart={() => void handleImportStart()}
        t={t}
      />

      <CulturesExportDialog
        open={exportDialogOpen}
        hasCurrentCulture={Boolean(selectedCulture)}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        t={t}
      />

      {/* Snackbar for notifications */}

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm"> 
        <DialogTitle>
          {historyScope === 'project'
            ? t('history.titles.project')
            : historyScope === 'global'
              ? t('history.titles.global')
              : t('history.titles.culture')}
        </DialogTitle>
        <DialogContent sx={{ pt: historyItems.length === 0 ? 1 : 2, pb: historyItems.length === 0 ? 1 : 2 }}>
          {historyItems.length === 0 ? (
            <Box sx={{ py: isMobile ? 0.5 : 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('history.emptyState.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('history.emptyState.description')}
              </Typography>
            </Box>
          ) : (
            <>
            <List>
              {historyItems.map((item, index) => {
                const isCurrentVersion = isCurrentHistoryEntry(item, index);
                const isCultureHistory = historyScope === 'culture';
                const historyTarget = getHistoryEntryTarget(item);
                const mobileTitle = getHistoryEntryTitle(item, t);
                const mobileMeta = getHistoryEntryMeta(item, t, fallbackHistoryActorLabel);
                const changes = item.changes ?? [];
                const changeList = changes.length > 0 ? (
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {t('history.changedFields')}
                    </Typography>
                    <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2 }}>
                      {changes.map((change) => (
                        <Typography
                          key={`${item.history_id}-${change.field}`}
                          component="li"
                          variant="caption"
                          color="text.secondary"
                          sx={{ lineHeight: 1.35 }}
                        >
                          <Typography component="span" variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {getHistoryChangeFieldLabel(change, t)}
                          </Typography>
                          {': '}
                          {change.field === 'created'
                            ? formatHistoryChangeValue(change.new_value, change.field, t)
                            : `${formatHistoryChangeValue(change.old_value, change.field, t)} → ${formatHistoryChangeValue(change.new_value, change.field, t)}`}
                        </Typography>
                      ))}
                    </Stack>
                  </Stack>
                ) : null;
                return (
                  <ListItem key={item.history_id} disableGutters sx={{ mb: isMobile ? 1 : 0 }}>
                    {isMobile ? (
                      <Paper variant="outlined" sx={{ width: '100%', p: 1.25, borderRadius: 1.5 }}>
                        <Stack spacing={1}>
                          {!isCultureHistory ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Chip
                                size="small"
                                label={item.object_type === 'culture' ? t('history.objectTypes.culture') : t('history.objectTypes.plantingPlan')}
                                variant="outlined"
                              />
                              {historyTarget ? (
                                <Link
                                  component={RouterLink}
                                  to={historyTarget}
                                  underline="hover"
                                  onClick={() => setHistoryOpen(false)}
                                  sx={{ fontSize: '0.78rem', color: 'text.secondary', flexShrink: 0 }}
                                >
                                  {t('history.objectTypes.openTarget')}
                                </Link>
                              ) : null}
                            </Box>
                          ) : null}
                          {!isCultureHistory ? (
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                lineHeight: 1.35,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                wordBreak: 'normal',
                                overflowWrap: 'break-word',
                              }}
                            >
                              {mobileTitle}
                            </Typography>
                          ) : null}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              lineHeight: 1.3,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              wordBreak: 'normal',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {mobileMeta}
                          </Typography>
                          {isCultureHistory ? changeList : null}
                          <Divider />
                          {isCurrentVersion ? (
                            <Chip
                              label={t('history.currentVersion')}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ alignSelf: 'flex-start' }}
                            />
                          ) : (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleRestoreVersion(item.history_id)}
                              sx={{ alignSelf: 'flex-start', minHeight: 34 }}
                            >
                              {t('history.restoreButton')}
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    ) : (
                      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
                        <ListItemText
                          sx={{ mr: 1 }}
                          disableTypography
                          primary={!isCultureHistory ? (
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                              {mobileTitle}
                              {historyTarget ? (
                                <>
                                  {' · '}
                                  <Link component={RouterLink} to={historyTarget} underline="hover" onClick={() => setHistoryOpen(false)}>
                                    {item.object_type === 'culture' ? t('history.objectTypes.culture') : t('history.objectTypes.plantingPlan')}
                                  </Link>
                                </>
                              ) : null}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {mobileMeta}
                            </Typography>
                          )}
                          secondary={isCultureHistory ? changeList : (
                            <Typography variant="caption" color="text.secondary">
                              {mobileMeta}
                            </Typography>
                          )}
                        />
                        {isCurrentVersion ? (
                          <Chip
                            label={t('history.currentVersion')}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Button onClick={() => handleRestoreVersion(item.history_id)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {t('history.restoreButton')}
                          </Button>
                        )}
                      </Stack>
                    )}
                  </ListItem>
                );
              })}
            </List>
            {historyItems.length === 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                {t('history.emptyState.onlyCurrentVersion')}
              </Typography>
            )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>{t('history.closeButton')}</Button>
        </DialogActions>
      </Dialog>



      <AlertSnackbar
        open={snackbar.open}
        autoHideDuration={4200}
        onClose={handleCloseSnackbar}
        message={snackbar.message}
        severity={snackbar.severity}
        variant="filled"
        snackbarSx={{
          '& .MuiAlert-root': {
            borderRadius: 2,
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
          },
        }}
        alertSx={{
          width: '100%',
          alignItems: 'center',
          fontWeight: 500,
        }}
      />
      {pendingCultureDeletions.map((deletion, index) => (
        <DeleteUndoSnackbar
          key={deletion.id}
          open={deletion.visible}
          message={t('messages.deleted')}
          undoLabel={t('common:actions.undo')}
          offsetIndex={index}
          testId="culture-delete-snackbar"
          onClose={() => closePendingCultureDeletionSnackbar(deletion.id)}
          onUndo={() => undoPendingCultureDeletion(deletion.id)}
        />
      ))}
    </PageContainer>
  );
}
export default Cultures;
