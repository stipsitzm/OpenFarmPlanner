import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FieldsBedsHierarchy from './FieldsBedsHierarchy';
import GraphicalFields from './GraphicalFields';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import type { CommandSpec } from '../commands/types';
import { useTranslation } from '../i18n';
import PageHelp from '../components/help/PageHelp';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import ModeToggle from '../components/ModeToggle';
import { bedAPI, fieldAPI, locationAPI, type Location } from '../api/api';
import { useFieldOperations } from '../components/hierarchy/hooks/useFieldOperations';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';

const VIEW_MODE_STORAGE_KEY = 'fieldsBedsViewMode';

type ViewMode = 'table' | 'graphical';
type InteractionMode = 'view' | 'edit';

export default function FieldsBedsPage(): React.ReactElement {
  const { t } = useTranslation(['fields', 'hierarchy']);
  const navigate = useNavigate();
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
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();

  useCommandContextTag('areas');

  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'areas.toggleGraphicalView',
      label: 'Ansicht umschalten (Alt+G)',
      group: 'navigation',
      keywords: ['ansicht', 'grafisch', 'tabelle', 'anbauflächen'],
      shortcutHint: 'Alt+G',
      contextTags: ['areas'],
      isEnabled: () => true,
      action: () => {
        setViewMode((previous) => (previous === 'graphical' ? 'table' : 'graphical'));
      },
    },
  ], []);

  useRegisterCommands('areas-view-switch', commands);

  const loadLocations = useCallback(async (): Promise<void> => {
    if (shouldShowProjectRequiredState) {
      setLocations([]);
      return;
    }
    try {
      const [locationsResponse, fieldsResponse, bedsResponse] = await Promise.all([
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
      ]);
      setLocations(locationsResponse.data.results);
      setFieldsCount(fieldsResponse.data.results.length);
      setBedsCount(bedsResponse.data.results.length);
    } catch (error) {
      console.error('Error loading locations for global action:', error);
    }
  }, [shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    if (viewMode === 'table') {
      void loadLocations();
    }
  }, [loadLocations, shouldShowProjectRequiredState, viewMode]);

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
  const shouldShowGlobalAddButton = viewMode === 'table'
    && !shouldShowProjectRequiredState
    && locations.length <= 1;

  const handleGlobalAddField = useCallback((): void => {
    if (locations.length === 0) {
      navigate('/app/locations?create=true');
      return;
    }

    if (locations.length === 1 && locations[0]?.id !== undefined) {
      setTargetLocationId(locations[0].id);
      setNewFieldName(`Parzelle ${2}`);
      setAddFieldDialogOpen(true);
      return;
    }
    const firstLocation = locations.find((location) => location.id !== undefined);
    setTargetLocationId(firstLocation?.id ?? '');
    setNewFieldName(`Parzelle ${2}`);
    setAddFieldDialogOpen(true);
  }, [addField, locations, navigate, t]);

  const handleConfirmAddField = useCallback((): void => {
    if (typeof targetLocationId !== 'number' || !newFieldName.trim()) {
      return;
    }
    void addField(targetLocationId, newFieldName.trim());
    setAddFieldDialogOpen(false);
    setNewFieldName('');
  }, [addField, newFieldName, targetLocationId]);


  useEffect(() => {
    const handleToggleViewShortcut = (event: KeyboardEvent): void => {
      if (event.repeat) {
        return;
      }
      if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key.toLowerCase() !== 'g') {
        return;
      }

      event.preventDefault();
      setViewMode((previous) => (previous === 'graphical' ? 'table' : 'graphical'));
    };

    window.addEventListener('keydown', handleToggleViewShortcut);
    return () => window.removeEventListener('keydown', handleToggleViewShortcut);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const hasLocations = locations.length > 0;
  const hasFields = fieldsCount > 0;
  const hasBeds = bedsCount > 0;
  const shouldShowAreasEmptyState = !hasLocations || !hasFields;
  const shouldShowMissingBedsHint = hasFields && !hasBeds;

  useEffect(() => {
    if (viewMode === 'graphical') {
      setInteractionMode('view');
    }
  }, [viewMode]);

  return (
    <>
      <PageContainer variant="standard">
        <PageHeader
          title={t('hierarchy:title')}
          actions={<PageHelp pageKey={viewMode === 'graphical' ? 'graphical' : 'areas'} />}
          marginBottom={1}
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Stack spacing={0.75} sx={{ width: { xs: '100%', sm: 'fit-content' } }}>
              <Typography variant="subtitle2">{t('fields:representation.label')}</Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, selectedViewMode: ViewMode | null) => {
                  if (selectedViewMode !== null) {
                    setViewMode(selectedViewMode);
                  }
                }}
                size="small"
                color="primary"
                aria-label={t('fields:representation.ariaLabel')}
                fullWidth
              >
                <ToggleButton value="table" aria-label={t('fields:representation.table')}>
                  {t('fields:representation.table')}
                </ToggleButton>
                <ToggleButton value="graphical" aria-label={t('fields:representation.graphical')}>
                  {t('fields:representation.graphical')}
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {viewMode === 'graphical' ? (
              <ModeToggle
                label={t('fields:graphical.viewMode')}
                ariaLabel={t('fields:graphical.modeAriaLabel')}
                viewLabel={t('fields:graphical.viewModeOption')}
                editLabel={t('fields:graphical.editModeOption')}
                value={interactionMode}
                onChange={setInteractionMode}
                fullWidth={false}
              />
            ) : null}
          </Box>
          {shouldShowGlobalAddButton ? (
            <Button
              variant="contained"
              onClick={handleGlobalAddField}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {locations.length === 0
                ? t('hierarchy:actions.createLocation')
                : t('hierarchy:actions.addField')}
            </Button>
          ) : null}
        </Box>
        {globalActionError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {globalActionError}
          </Alert>
        ) : null}
        {shouldShowProjectRequiredState && missingProjectReason ? (
          <ProjectRequiredState reason={missingProjectReason} />
        ) : null}
        {!shouldShowProjectRequiredState && shouldShowMissingBedsHint ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('hierarchy:messages.noBedsHint')}
          </Alert>
        ) : null}
        {!shouldShowProjectRequiredState && shouldShowAreasEmptyState ? (
          <EmptyStateCard
            title={t('hierarchy:emptyAreas.title')}
            description={t('hierarchy:emptyAreas.description')}
            checklist={[
              { label: t('hierarchy:columns.location'), done: hasLocations },
              { label: t('hierarchy:columns.field'), done: hasFields },
            ]}
            actions={[
              ...(!hasLocations ? [{ label: t('hierarchy:emptyAreas.actions.createLocation'), onClick: () => navigate('/app/locations?create=true') }] : []),
              ...(hasLocations && !hasFields ? [{ label: t('hierarchy:emptyAreas.actions.createField'), onClick: handleGlobalAddField }] : []),
            ]}
          />
        ) : null}
      </PageContainer>

      <PageContainer variant={viewMode === 'graphical' ? 'full' : 'standard'}>
        {!shouldShowProjectRequiredState && !shouldShowAreasEmptyState && viewMode === 'graphical' ? (
          <GraphicalFields
            showTitle={false}
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            showModeToggle={false}
          />
        ) : null}
        {!shouldShowProjectRequiredState && !shouldShowAreasEmptyState && viewMode !== 'graphical' ? (
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
