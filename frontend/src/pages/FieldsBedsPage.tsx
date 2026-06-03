import { Alert, Box, Button, ButtonGroup, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, useMediaQuery } from '@mui/material';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import FieldsBedsHierarchy from './FieldsBedsHierarchy';
import GraphicalFields from './GraphicalFields';
import { AddBedIcon } from '../components/hierarchy/AddBedIcon';
import { HierarchyAddIcon } from '../components/hierarchy/HierarchyAddIcon';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import type { CommandSpec } from '../commands/types';
import { useTranslation } from '../i18n';
import PageContainer from '../components/layout/PageContainer';
import { locationAPI } from '../api/api';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard, { type EmptyStateAction } from '../components/project/EmptyStateCard';
import { getProjectSetupAction } from './requirementFlow';
import type { RootLayoutOutletContext, TopbarContextAction } from '../App';
import { getSegmentedActionButtonSx, segmentedButtonGroupSx } from '../components/buttons/segmentedControlStyles';
import { useTheme } from '@mui/material/styles';
import ContentViewControls from '../components/layout/ContentViewControls';
import { ContextMenuHint } from '../components/data-grid';
import AddIcon from '@mui/icons-material/Add';
import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';

const VIEW_MODE_STORAGE_KEY = 'fieldsBedsViewMode';
const NOOP_SET_TOPBAR_ACTIONS = (): void => undefined;

type ViewMode = 'table' | 'graphical';
type InteractionMode = 'view' | 'edit';

export default function FieldsBedsPage(): React.ReactElement {
  const { t } = useTranslation(['fields', 'hierarchy', 'common']);
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'graphical' ? 'graphical' : 'table';
  });
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('view');
  const [globalActionError, setGlobalActionError] = useState<string>('');
  const [globalActionSuccess, setGlobalActionSuccess] = useState<string>('');
  const [createFieldRequest, setCreateFieldRequest] = useState(0);
  const [pendingHierarchyDeletionCount, setPendingHierarchyDeletionCount] = useState(0);
  const [addLocationDialogOpen, setAddLocationDialogOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const hierarchyData = useHierarchyData(!shouldShowProjectRequiredState);
  const {
    loading: isAreaDataLoading,
    hasLoaded: hasAreaDataLoaded,
    locations,
    fields,
    beds,
    fetchData: reloadHierarchyData,
  } = hierarchyData;

  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions ?? NOOP_SET_TOPBAR_ACTIONS;

  useCommandContextTag('areas');

  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'areas.showListView',
      label: 'Listenansicht',
      group: 'navigation',
      keywords: ['liste', 'tabelle', 'anbauflächen'],
      shortcutHint: 'Alt+L',
      keys: { alt: true, key: 'l' },
      contextTags: ['areas'],
      isEnabled: () => viewMode !== 'table',
      action: () => {
        setViewMode('table');
      },
    },
    {
      id: 'areas.showGraphicalView',
      label: 'Grafikansicht',
      group: 'navigation',
      keywords: ['grafik', 'grafisch', 'anbauflächen'],
      shortcutHint: 'Alt+G',
      keys: { alt: true, key: 'g' },
      contextTags: ['areas'],
      isEnabled: () => true,
      action: () => {
        setViewMode((prev) => (prev === 'graphical' ? 'table' : 'graphical'));
      },
    },
  ], [viewMode]);

  useRegisterCommands('areas-view-switch', commands);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setPendingHierarchyDeletionCount(0);
    }
  }, [shouldShowProjectRequiredState]);

  const hasAddFieldTarget = locations.some((item) => item.id !== undefined);
  const canUseGlobalAddField = locations.length === 1 && locations[0]?.id !== undefined;

  const requestInlineFieldCreation = useCallback((): void => {
    if (!hasAddFieldTarget) {
      setGlobalActionError(t('hierarchy:messages.createLocationError'));
      return;
    }

    setViewMode('table');
    setCreateFieldRequest((currentRequest) => currentRequest + 1);
  }, [hasAddFieldTarget, t]);

  const openAddLocationDialog = useCallback((): void => {
    setNewLocationName('');
    setAddLocationDialogOpen(true);
  }, []);

  const handleCreateAdditionalLocation = useCallback(async (): Promise<void> => {
    const trimmedName = newLocationName.trim();
    if (!trimmedName) {
      return;
    }
    try {
      await locationAPI.create({ name: trimmedName });
      setAddLocationDialogOpen(false);
      setNewLocationName('');
      await reloadHierarchyData();
      setGlobalActionError('');
      setGlobalActionSuccess(t('hierarchy:messages.locationCreated'));
    } catch (error) {
      console.error('Error creating additional location:', error);
      setGlobalActionError(t('hierarchy:messages.createLocationError'));
    }
  }, [newLocationName, reloadHierarchyData, t]);

  const handleAdditionalLocationSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!newLocationName.trim()) {
      return;
    }
    void handleCreateAdditionalLocation();
  };

  useEffect(() => {
    if (!location.pathname.startsWith('/app/fields-beds')) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('create') !== 'true') {
      return;
    }

    if (shouldShowProjectRequiredState || !hasAreaDataLoaded || isAreaDataLoading) {
      return;
    }

    requestInlineFieldCreation();

    searchParams.delete('create');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [
    hasAreaDataLoaded,
    isAreaDataLoading,
    location.pathname,
    location.search,
    navigate,
    requestInlineFieldCreation,
    shouldShowProjectRequiredState,
  ]);


  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const hasLocations = locations.length > 0;
  const hasFields = fields.length > 0;
  const hasBeds = beds.length > 0;
  const shouldShowAreasEmptyState = hasAreaDataLoaded && !isAreaDataLoading && !hasLocations;
  const shouldShowMissingFieldsState = hasLocations && !hasFields;
  const shouldShowMissingBedsHint = hasFields && !hasBeds;
  const shouldRenderHierarchy = hasLocations || pendingHierarchyDeletionCount > 0;
  const createBedAction = getProjectSetupAction('beds');
  const emptyAreasDescription = shouldShowMissingFieldsState
    ? (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        {t('hierarchy:emptyAreas.missingFieldDescriptionBeforeIcon')}
        <HierarchyAddIcon interactive={false} ariaHidden sx={{ bgcolor: 'transparent' }} />
        {t('hierarchy:emptyAreas.missingFieldDescriptionAfterIcon')}
      </Box>
    )
    : t('hierarchy:emptyAreas.description');
  const emptyAreaActions = useMemo<EmptyStateAction[]>(() => {
    if (shouldShowMissingFieldsState) {
      return [];
    }
    return [{ label: t('hierarchy:actions.createLocation'), onClick: openAddLocationDialog, icon: <AddIcon fontSize="small" /> }];
  }, [openAddLocationDialog, shouldShowMissingFieldsState, t]);

  useEffect(() => {
    if (viewMode === 'graphical') {
      setInteractionMode('view');
    }
  }, [viewMode]);

  const viewModeActions = useMemo<TopbarContextAction[]>(() => ([
    {
      id: 'fields-view-mode-list',
      label: t('fields:representation.table'),
      onClick: () => setViewMode('table'),
      active: viewMode === 'table',
      ariaLabel: t('fields:representation.ariaLabel'),
      groupId: 'fields-view-mode',
    },
    {
      id: 'fields-view-mode-graphical',
      label: t('fields:representation.graphical'),
      onClick: () => setViewMode('graphical'),
      active: viewMode === 'graphical',
      ariaLabel: t('fields:representation.ariaLabel'),
      groupId: 'fields-view-mode',
    },
  ]), [t, viewMode]);

  const interactionModeActions = useMemo<TopbarContextAction[]>(() => ([
    {
      id: 'fields-interaction-mode-view',
      label: t('fields:graphical.viewModeOption'),
      onClick: () => setInteractionMode('view'),
      active: interactionMode === 'view',
      hidden: viewMode !== 'graphical',
      ariaLabel: t('fields:graphical.modeAriaLabel'),
      groupId: 'fields-interaction-mode',
    },
    {
      id: 'fields-interaction-mode-edit',
      label: t('fields:graphical.editModeOption'),
      onClick: () => setInteractionMode('edit'),
      active: interactionMode === 'edit',
      hidden: viewMode !== 'graphical',
      ariaLabel: t('fields:graphical.modeAriaLabel'),
      groupId: 'fields-interaction-mode',
    },
  ]), [interactionMode, t, viewMode]);

  const contextActions = useMemo<TopbarContextAction[]>(() => {
    const globalActions: TopbarContextAction[] = shouldShowProjectRequiredState
      ? []
      : [
        ...(canUseGlobalAddField ? [{
          id: 'fields-global-add-field',
          label: t('hierarchy:actions.addField'),
          onClick: requestInlineFieldCreation,
          ariaLabel: t('hierarchy:actions.addField'),
        }] : []),
        {
          id: 'fields-global-add-location',
          label: t('hierarchy:actions.createLocation'),
          onClick: openAddLocationDialog,
          ariaLabel: t('hierarchy:actions.createLocation'),
        },
      ];
    if (isXs) {
      return globalActions;
    }
    return [...globalActions, ...interactionModeActions, ...viewModeActions];
  }, [
    canUseGlobalAddField,
    requestInlineFieldCreation,
    interactionModeActions,
    isXs,
    openAddLocationDialog,
    shouldShowProjectRequiredState,
    t,
    viewModeActions,
  ]);

  useEffect(() => {
    setTopbarContextActions(contextActions);
    return () => setTopbarContextActions([]);
  }, [contextActions, setTopbarContextActions]);

  return (
    <>
      <PageContainer variant="standard">
        {globalActionError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {globalActionError}
          </Alert>
        ) : null}
        {globalActionSuccess ? (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setGlobalActionSuccess('')}>
            {globalActionSuccess}
          </Alert>
        ) : null}
        {shouldShowProjectRequiredState && missingProjectReason ? (
          <ProjectRequiredState reason={missingProjectReason} />
        ) : null}
        {!shouldShowProjectRequiredState && isAreaDataLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && shouldShowMissingBedsHint ? (
          <EmptyStateCard
            title={t('hierarchy:messages.noBedsHintTitle')}
            description={(
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                {t('hierarchy:messages.noBedsHintBeforeIcon')}
                <AddBedIcon interactive={false} ariaHidden />
                {t('hierarchy:messages.noBedsHintAfterIcon')}
              </Box>
            )}
            supplement={viewMode !== 'graphical' ? (
              <ContextMenuHint
                compact
                message={t('hierarchy:messages.contextMenuTableHint')}
                secondary={t('hierarchy:messages.contextMenuHintKeyboard')}
              />
            ) : undefined}
            actions={[{ label: t(createBedAction.labelKey), to: createBedAction.to }]}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && (shouldShowAreasEmptyState || shouldShowMissingFieldsState) ? (
          <EmptyStateCard
            title={shouldShowMissingFieldsState ? t('hierarchy:emptyAreas.missingFieldTitle') : t('hierarchy:emptyAreas.title')}
            description={emptyAreasDescription}
            checklist={!hasLocations ? [{
              label: t('hierarchy:columns.location'),
              done: false,
              missingLabel: t('hierarchy:emptyAreas.missingLocationLabel'),
            }] : []}
            actions={emptyAreaActions}
          />
        ) : null}
      </PageContainer>

      <PageContainer variant={viewMode === 'graphical' ? 'full' : 'standard'}>
        {isXs && !shouldShowProjectRequiredState && !isAreaDataLoading && shouldRenderHierarchy ? (
          <ContentViewControls
            primaryControls={(
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.375, flexWrap: 'nowrap', minWidth: 0, whiteSpace: 'nowrap' }}>
                <ButtonGroup size="small" variant="outlined" sx={{ ...segmentedButtonGroupSx, flexShrink: 0, minWidth: 0 }}>
                  <Button
                    aria-label={viewModeActions[0].ariaLabel ?? viewModeActions[0].label}
                    aria-pressed={viewModeActions[0].active}
                    variant={viewModeActions[0].active ? 'contained' : 'outlined'}
                    color={viewModeActions[0].active ? 'success' : 'inherit'}
                    onClick={viewModeActions[0].onClick}
                    sx={{ ...getSegmentedActionButtonSx({ active: Boolean(viewModeActions[0].active) }), px: 0.875, minHeight: 40, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    {viewModeActions[0].label}
                  </Button>
                  <Button
                    aria-label={viewModeActions[1].ariaLabel ?? viewModeActions[1].label}
                    aria-pressed={viewModeActions[1].active}
                    variant={viewModeActions[1].active ? 'contained' : 'outlined'}
                    color={viewModeActions[1].active ? 'success' : 'inherit'}
                    onClick={viewModeActions[1].onClick}
                    sx={{ ...getSegmentedActionButtonSx({ active: Boolean(viewModeActions[1].active) }), px: 0.875, minHeight: 40, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    {viewModeActions[1].label}
                  </Button>
                </ButtonGroup>
                {interactionModeActions.every((action) => !action.hidden) ? (
                  <ButtonGroup size="small" variant="outlined" sx={{ ...segmentedButtonGroupSx, flexShrink: 0, minWidth: 0 }}>
                    <Button
                      aria-label={interactionModeActions[0].ariaLabel ?? interactionModeActions[0].label}
                      aria-pressed={interactionModeActions[0].active}
                      variant={interactionModeActions[0].active ? 'contained' : 'outlined'}
                      color={interactionModeActions[0].active ? 'success' : 'inherit'}
                      onClick={interactionModeActions[0].onClick}
                      sx={{ ...getSegmentedActionButtonSx({ active: Boolean(interactionModeActions[0].active) }), px: 0.875, minHeight: 40, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      {interactionModeActions[0].label}
                    </Button>
                    <Button
                      aria-label={interactionModeActions[1].ariaLabel ?? interactionModeActions[1].label}
                      aria-pressed={interactionModeActions[1].active}
                      variant={interactionModeActions[1].active ? 'contained' : 'outlined'}
                      color={interactionModeActions[1].active ? 'success' : 'inherit'}
                      onClick={interactionModeActions[1].onClick}
                      sx={{ ...getSegmentedActionButtonSx({ active: Boolean(interactionModeActions[1].active) }), px: 0.875, minHeight: 40, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      {interactionModeActions[1].label}
                    </Button>
                  </ButtonGroup>
                ) : null}
              </Box>
            )}
            sx={{
              mb: 0.75,
              '& > div': {
                flexWrap: 'nowrap',
                minWidth: 0,
                gap: 0.375,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              },
            }}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && shouldRenderHierarchy && viewMode === 'graphical' ? (
          <GraphicalFields
            showTitle={false}
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            showModeToggle={false}
            hierarchyData={hierarchyData}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && shouldRenderHierarchy && viewMode !== 'graphical' ? (
          <>
            {hasLocations && !shouldShowMissingBedsHint ? (
              <Box sx={{ mb: 1.25 }}>
                <ContextMenuHint
                  message={t('hierarchy:messages.contextMenuTableHint')}
                  secondary={t('hierarchy:messages.contextMenuHintKeyboard')}
                />
              </Box>
            ) : null}
            <FieldsBedsHierarchy
              showTitle={false}
              createFieldRequest={createFieldRequest}
              onCreateFieldRequestHandled={() => setCreateFieldRequest(0)}
              hierarchyData={hierarchyData}
              onPendingDeletionCountChange={setPendingHierarchyDeletionCount}
            />
          </>
        ) : null}
      </PageContainer>
      <Dialog open={addLocationDialogOpen} onClose={() => setAddLocationDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleAdditionalLocationSubmit}>
          <DialogTitle>{t('hierarchy:dialogs.addAdditionalLocation.title')}</DialogTitle>
          <DialogContent>
            <Box sx={{ color: 'text.secondary', mb: 2, mt: 1 }}>
              {t('hierarchy:dialogs.addAdditionalLocation.description')}
            </Box>
            <TextField
              margin="dense"
              fullWidth
              label={t('hierarchy:dialogs.addAdditionalLocation.nameLabel')}
              value={newLocationName}
              onChange={(event) => setNewLocationName(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={() => setAddLocationDialogOpen(false)}>{t('common:actions.cancel')}</Button>
            <Button type="submit" variant="contained" color="success" disabled={!newLocationName.trim()}>
              {t('hierarchy:dialogs.addAdditionalLocation.submit')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
