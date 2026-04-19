import { Alert, Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
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
import { locationAPI, type Location } from '../api/api';
import { useFieldOperations } from '../components/hierarchy/hooks/useFieldOperations';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';

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
  const [globalActionError, setGlobalActionError] = useState<string>('');
  const [hierarchyRenderKey, setHierarchyRenderKey] = useState(0);
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
      const response = await locationAPI.list();
      setLocations(response.data.results);
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

  const handleGlobalAddField = useCallback((): void => {
    if (locations.length === 0) {
      navigate('/app/locations');
      return;
    }

    if (locations.length === 1 && locations[0]?.id !== undefined) {
      void addField(locations[0].id);
      return;
    }

    const locationOptions = locations
      .filter((location) => location.id !== undefined)
      .map((location) => `${location.id}: ${location.name}`)
      .join('\n');

    const selectedLocationId = window.prompt(
      t('hierarchy:prompts.selectLocationForField', { options: locationOptions }),
    );

    if (!selectedLocationId) {
      return;
    }

    const parsedLocationId = Number.parseInt(selectedLocationId.trim(), 10);
    const matchingLocation = locations.find((location) => location.id === parsedLocationId);

    if (!matchingLocation?.id) {
      setGlobalActionError(t('hierarchy:messages.invalidLocationSelection'));
      return;
    }

    void addField(matchingLocation.id);
  }, [addField, locations, navigate, t]);


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
          {viewMode === 'table' && !shouldShowProjectRequiredState ? (
            <Button variant="contained" onClick={handleGlobalAddField}>
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
      </PageContainer>

      <PageContainer variant={viewMode === 'graphical' ? 'full' : 'standard'}>
        {!shouldShowProjectRequiredState && viewMode === 'graphical' ? (
          <GraphicalFields
            showTitle={false}
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            showModeToggle={false}
          />
        ) : null}
        {!shouldShowProjectRequiredState && viewMode !== 'graphical' ? (
          <FieldsBedsHierarchy key={hierarchyRenderKey} showTitle={false} />
        ) : null}
      </PageContainer>
    </>
  );
}
