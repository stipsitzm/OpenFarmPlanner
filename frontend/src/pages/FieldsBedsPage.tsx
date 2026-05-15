import { Alert, Box, Button, ButtonGroup, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, useMediaQuery } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import FieldsBedsHierarchy from './FieldsBedsHierarchy';
import GraphicalFields from './GraphicalFields';
import { AddBedIcon } from '../components/hierarchy/AddBedIcon';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import type { CommandSpec } from '../commands/types';
import { useTranslation } from '../i18n';
import PageContainer from '../components/layout/PageContainer';
import { bedAPI, fieldAPI, locationAPI, type Location } from '../api/api';
import { useFieldOperations } from '../components/hierarchy/hooks/useFieldOperations';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { getProjectSetupAction } from './requirementFlow';
import type { RootLayoutOutletContext, TopbarContextAction } from '../App';
import { getSegmentedActionButtonSx, segmentedButtonGroupSx } from '../components/buttons/segmentedControlStyles';
import { useTheme } from '@mui/material/styles';
import ContentViewControls from '../components/layout/ContentViewControls';

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
  const [locations, setLocations] = useState<Location[]>([]);
  const [fieldsCount, setFieldsCount] = useState(0);
  const [bedsCount, setBedsCount] = useState(0);
  const [globalActionError, setGlobalActionError] = useState<string>('');
  const [hierarchyRenderKey, setHierarchyRenderKey] = useState(0);
  const [addFieldDialogOpen, setAddFieldDialogOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [targetLocationId, setTargetLocationId] = useState<number | ''>('');
  const [isAreaDataLoading, setIsAreaDataLoading] = useState(false);
  const [hasAreaDataLoaded, setHasAreaDataLoaded] = useState(false);
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();

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

  const loadLocations = useCallback(async (): Promise<void> => {
    if (shouldShowProjectRequiredState) {
      setLocations([]);
      setFieldsCount(0);
      setBedsCount(0);
      setHasAreaDataLoaded(false);
      setIsAreaDataLoading(false);
      return;
    }
    setIsAreaDataLoading(true);
    try {
      const [locationsResponse, fieldsResponse, bedsResponse] = await Promise.all([
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
      ]);
      setLocations(locationsResponse.data.results);
      setFieldsCount(fieldsResponse.data.results.length);
      setBedsCount(bedsResponse.data.results.length);
      setHasAreaDataLoaded(true);
    } catch (error) {
      console.error('Error loading locations for global action:', error);
      setHasAreaDataLoaded(true);
    } finally {
      setIsAreaDataLoading(false);
    }
  }, [shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    void loadLocations();
  }, [loadLocations, shouldShowProjectRequiredState]);

  const reloadHierarchyAndLocations = useCallback(async (): Promise<void> => {
    setHierarchyRenderKey((previous) => previous + 1);
    await loadLocations();
  }, [loadLocations]);

  const { addField } = useFieldOperations(
    locations,
    setGlobalActionError,
    reloadHierarchyAndLocations,
    t as never,
  );
  const handleGlobalAddField = useCallback((): void => {
    if (locations.length === 0) {
      navigate('/app/locations?create=true');
      return;
    }

    if (locations.length === 1 && locations[0]?.id !== undefined) {
      setTargetLocationId(locations[0].id);
      setNewFieldName('');
      setAddFieldDialogOpen(true);
      return;
    }
    const firstLocation = locations.find((location) => location.id !== undefined);
    setTargetLocationId(firstLocation?.id ?? '');
    setNewFieldName('');
    setAddFieldDialogOpen(true);
  }, [locations, navigate]);

  const handleConfirmAddField = useCallback((): void => {
    if (typeof targetLocationId !== 'number' || !newFieldName.trim()) {
      return;
    }
    void addField(targetLocationId, newFieldName.trim());
    setAddFieldDialogOpen(false);
    setNewFieldName('');
  }, [addField, newFieldName, targetLocationId]);

  useEffect(() => {
    if (!location.pathname.startsWith('/app/fields-beds')) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('create') !== 'true') {
      return;
    }
    handleGlobalAddField();
    searchParams.delete('create');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleGlobalAddField, location.pathname, location.search, navigate]);


  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const hasLocations = locations.length > 0;
  const hasFields = fieldsCount > 0;
  const hasBeds = bedsCount > 0;
  const shouldShowAreasEmptyState = hasAreaDataLoaded && !isAreaDataLoading && (!hasLocations || !hasFields);
  const shouldShowMissingBedsHint = hasFields && !hasBeds;
  const createLocationAction = getProjectSetupAction('locations');
  const createFieldAction = getProjectSetupAction('fields');
  const createBedAction = getProjectSetupAction('beds');

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
    const globalActions: TopbarContextAction[] = locations.length === 1 && !shouldShowProjectRequiredState
      ? [{
        id: 'fields-global-add-field',
        label: 'Parzelle hinzufügen',
        onClick: handleGlobalAddField,
        ariaLabel: 'Parzelle hinzufügen',
      }]
      : [];
    if (isXs) {
      return globalActions;
    }
    return [...globalActions, ...interactionModeActions, ...viewModeActions];
  }, [
    handleGlobalAddField,
    interactionModeActions,
    isXs,
    locations.length,
    shouldShowProjectRequiredState,
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
            actions={[{ label: t(createBedAction.labelKey), to: createBedAction.to }]}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && shouldShowAreasEmptyState ? (
          <EmptyStateCard
            title={t('hierarchy:emptyAreas.title')}
            description={t('hierarchy:emptyAreas.description')}
            checklist={[
              { label: t('hierarchy:columns.location'), done: hasLocations },
              { label: t('hierarchy:columns.field'), done: hasFields },
            ]}
            actions={[
              ...(!hasLocations ? [{ label: t(createLocationAction.labelKey), onClick: () => navigate(createLocationAction.to) }] : []),
              ...(hasLocations && !hasFields ? [{ label: t(createFieldAction.labelKey), onClick: handleGlobalAddField }] : []),
            ]}
          />
        ) : null}
      </PageContainer>

      <PageContainer variant={viewMode === 'graphical' ? 'full' : 'standard'}>
        {isXs && !shouldShowProjectRequiredState && !isAreaDataLoading && !shouldShowAreasEmptyState ? (
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
        {!shouldShowProjectRequiredState && !isAreaDataLoading && !shouldShowAreasEmptyState && viewMode === 'graphical' ? (
          <GraphicalFields
            showTitle={false}
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            showModeToggle={false}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !isAreaDataLoading && !shouldShowAreasEmptyState && viewMode !== 'graphical' ? (
          <FieldsBedsHierarchy key={hierarchyRenderKey} showTitle={false} />
        ) : null}
      </PageContainer>
      <Dialog open={addFieldDialogOpen} onClose={() => setAddFieldDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('hierarchy:dialogs.addField.title')}</DialogTitle>
        <DialogContent>
          {locations.length > 1 ? (
            <TextField
              select
              margin="dense"
              fullWidth
              label={t('hierarchy:columns.location')}
              value={targetLocationId}
              onChange={(event) => setTargetLocationId(Number(event.target.value))}
            >
              {locations.filter((location) => location.id !== undefined).map((location) => (
                <MenuItem key={location.id} value={location.id}>{location.name}</MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField
            margin="dense"
            fullWidth
            label={t('hierarchy:dialogs.addField.nameLabel')}
            value={newFieldName}
            onChange={(event) => setNewFieldName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFieldDialogOpen(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={handleConfirmAddField} variant="contained" disabled={!newFieldName.trim() || typeof targetLocationId !== 'number'}>
            {t('hierarchy:dialogs.addField.submit')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
