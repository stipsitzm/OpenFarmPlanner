import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Link, TextField, Typography } from '@mui/material';
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
import { useTopbarContextActions } from '../hooks/useTopbarContextActions';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard, { type EmptyStateAction } from '../components/project/EmptyStateCard';
import { getProjectSetupAction } from './requirementFlow';
import type { RootLayoutOutletContext, TopbarContextAction } from '../App';
import { type SxProps, type Theme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';

const VIEW_MODE_STORAGE_KEY = 'fieldsBedsViewMode';
const ADD_PARCEL_ACTION = 'add-parcel';
const CONTENT_ALIGNED_EMPTY_STATE_SX: SxProps<Theme> = {
  maxWidth: 560,
  my: { xs: 3, md: 5 },
  p: { xs: 2.5, sm: 3 },
  textAlign: 'center',
  '& > .MuiBox-root:first-of-type': {
    justifyContent: 'center',
  },
  '& > .MuiBox-root:last-of-type': {
    justifyContent: 'center',
  },
};

type ViewMode = 'table' | 'graphical';

const hasPersistedEntityId = (id: number | undefined): id is number =>
  typeof id === 'number' && id > 0;

export default function FieldsBedsPage() {
  const { t } = useTranslation(['fields', 'hierarchy', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'graphical' ? 'graphical' : 'table';
  });
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
  const setTopbarContextActions = outletContext?.setTopbarContextActions;

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
  const isSingleLocationMode = locations.length === 1 && locations[0]?.id !== undefined;
  const canUseGlobalAddField = isSingleLocationMode;
  const hasActiveFieldDraft = fields.some((field) => !hasPersistedEntityId(field.id));

  const requestInlineFieldCreation = useCallback((): void => {
    if (!hasAddFieldTarget) {
      setGlobalActionError(t('hierarchy:messages.createLocationError'));
      return;
    }

    setViewMode('table');
    if (hasActiveFieldDraft || createFieldRequest > 0) {
      return;
    }
    setCreateFieldRequest((currentRequest) => currentRequest + 1);
  }, [createFieldRequest, hasActiveFieldDraft, hasAddFieldTarget, t]);

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
      const wasSingleLocationMode = locations.length === 1;
      await locationAPI.create({ name: trimmedName });
      setAddLocationDialogOpen(false);
      setNewLocationName('');
      await reloadHierarchyData();
      setGlobalActionError('');
      setGlobalActionSuccess(wasSingleLocationMode
        ? t('hierarchy:messages.locationsNowVisible')
        : t('hierarchy:messages.locationCreated'));
    } catch (error) {
      console.error('Error creating additional location:', error);
      setGlobalActionError(t('hierarchy:messages.createLocationError'));
    }
  }, [locations.length, newLocationName, reloadHierarchyData, t]);

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
    const shouldAddParcel =
      searchParams.get('action') === ADD_PARCEL_ACTION ||
      searchParams.get('create') === 'true';
    if (!shouldAddParcel) {
      return;
    }

    if (shouldShowProjectRequiredState || !hasAreaDataLoaded || isAreaDataLoading) {
      return;
    }

    requestInlineFieldCreation();

    searchParams.delete('action');
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
  const persistedFieldIds = useMemo(
    () => new Set(fields.map((field) => field.id).filter(hasPersistedEntityId)),
    [fields],
  );
  const hasFields = persistedFieldIds.size > 0;
  const hasUnsavedFields = fields.some((field) => !hasPersistedEntityId(field.id));
  const hasUnsavedBeds = beds.some((bed) => !hasPersistedEntityId(bed.id));
  const hasBeds = beds.some((bed) => hasPersistedEntityId(bed.id) && persistedFieldIds.has(bed.field));
  const hasHierarchyRows = fields.length > 0 || beds.length > 0;
  const shouldShowAreasEmptyState = hasAreaDataLoaded && !isAreaDataLoading && !hasLocations;
  const shouldShowMissingFieldsState = hasLocations && !hasFields && !hasUnsavedFields && createFieldRequest <= 0;
  const shouldShowMissingBedsHint = hasFields && !hasBeds && !hasUnsavedBeds;
  const shouldRenderHierarchy = hasHierarchyRows || createFieldRequest > 0 || pendingHierarchyDeletionCount > 0;
  const createBedAction = getProjectSetupAction('beds');
  const emptyAreasDescription = shouldShowMissingFieldsState
    ? t(locations.length === 1
      ? 'hierarchy:emptyAreas.missingFieldSingleLocationDescription'
      : 'hierarchy:emptyAreas.missingFieldMultipleLocationsDescription')
    : t('hierarchy:emptyAreas.missingLocationDescription');
  const emptyAreasSupplement = shouldShowMissingFieldsState && isSingleLocationMode
    ? (
        <Typography variant="body2" color="text.secondary">
          {t('hierarchy:emptyAreas.additionalLocationHint')}{' '}
          <Link
            href="#add-location"
            onClick={(event) => {
              event.preventDefault();
              openAddLocationDialog();
            }}
            underline="hover"
          >
            {t('hierarchy:emptyAreas.additionalLocationLink')}
          </Link>
          .
        </Typography>
      )
    : undefined;
  const emptyAreaActions = useMemo<EmptyStateAction[]>(() => {
    if (shouldShowMissingFieldsState) {
      return locations.length === 1
        ? [{
            label: t('hierarchy:actions.addField'),
            onClick: requestInlineFieldCreation,
            icon: <HierarchyAddIcon interactive={false} ariaHidden sx={{ bgcolor: 'transparent' }} />,
          }]
        : [];
    }
    return [{ label: t('hierarchy:actions.createLocation'), onClick: openAddLocationDialog, icon: <AddIcon fontSize="small" /> }];
  }, [locations.length, openAddLocationDialog, requestInlineFieldCreation, shouldShowMissingFieldsState, t]);

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

  const contextActions = useMemo<TopbarContextAction[]>(() => {
    const globalActions: TopbarContextAction[] = shouldShowProjectRequiredState
      ? []
      : [
        ...(canUseGlobalAddField ? [{
          id: 'fields-global-add-field',
          label: t('hierarchy:actions.addFieldDropdown'),
          onClick: requestInlineFieldCreation,
          ariaLabel: t('hierarchy:actions.addFieldDropdown'),
          menuActions: [
            {
              id: 'fields-global-add-field-menu-item',
              label: t('hierarchy:actions.addField'),
              onClick: requestInlineFieldCreation,
            },
            {
              id: 'fields-global-add-location-menu-item',
              label: t('hierarchy:actions.createLocation'),
              onClick: openAddLocationDialog,
            },
          ],
        }] : []),
        {
          id: 'fields-global-add-location',
          label: t('hierarchy:actions.createLocation'),
          onClick: openAddLocationDialog,
          ariaLabel: t('hierarchy:actions.createLocation'),
          hidden: isSingleLocationMode,
        },
      ];
    return [...globalActions, ...viewModeActions];
  }, [
    canUseGlobalAddField,
    requestInlineFieldCreation,
    openAddLocationDialog,
    shouldShowProjectRequiredState,
    isSingleLocationMode,
    t,
    viewModeActions,
  ]);

  useTopbarContextActions(setTopbarContextActions, contextActions);

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
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {t('hierarchy:messages.noBedsHintBeforeIcon')}
                <AddBedIcon interactive={false} ariaHidden />
                {t('hierarchy:messages.noBedsHintAfterIcon')}
              </Box>
            )}
            actions={[{ label: t(createBedAction.labelKey), to: createBedAction.to }]}
            containerSx={CONTENT_ALIGNED_EMPTY_STATE_SX}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && (shouldShowAreasEmptyState || shouldShowMissingFieldsState) ? (
          <EmptyStateCard
            title={shouldShowMissingFieldsState ? t('hierarchy:emptyAreas.missingFieldTitle') : t('hierarchy:emptyAreas.missingLocationTitle')}
            description={emptyAreasDescription}
            actions={emptyAreaActions}
            supplement={emptyAreasSupplement}
            containerSx={CONTENT_ALIGNED_EMPTY_STATE_SX}
          />
        ) : null}
      </PageContainer>

      <PageContainer variant={viewMode === 'graphical' ? 'full' : 'standard'}>
        {!shouldShowProjectRequiredState && !isAreaDataLoading && shouldRenderHierarchy && viewMode === 'graphical' ? (
          <GraphicalFields
            showTitle={false}
            showModeToggle={false}
            hierarchyData={hierarchyData}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && shouldRenderHierarchy && viewMode !== 'graphical' ? (
          <FieldsBedsHierarchy
            showTitle={false}
            createFieldRequest={createFieldRequest}
            onCreateFieldRequestHandled={() => setCreateFieldRequest(0)}
            hierarchyData={hierarchyData}
            onPendingDeletionCountChange={setPendingHierarchyDeletionCount}
            suppressContextMenuHint={shouldShowMissingBedsHint}
          />
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
