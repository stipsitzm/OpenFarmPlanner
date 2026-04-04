/**
 * Locations (Standorte) page component.
 * 
 * Manages farm locations with Excel-like editable data grid.
 * Uses MUI Data Grid for inline editing with validation.
 * 
 * @returns The Locations page component
 */

import { useMemo, useRef, useState } from 'react';
import type { GridColDef } from '@mui/x-data-grid';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from '../i18n';
import { locationAPI, type Location } from '../api/api';
import { EditableDataGrid, type EditableDataGridCommandApi, type EditableRow, type DataGridAPI } from '../components/data-grid';
import PageHelp from '../components/help/PageHelp';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import type { CommandSpec } from '../commands/types';
import { formatLocalizedNumber, resolveLocaleFromLanguage } from '../utils/numberLocalization';

interface LocationRow extends Location, EditableRow {
  id: number;
  isNew?: boolean;
}

const parseCoordinateInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateCoordinateRange = (
  value: number | null,
  min: number,
  max: number,
): boolean => value === null || (value >= min && value <= max);

function Locations(): React.ReactElement {
  const { t } = useTranslation(['locations', 'common']);
  const { i18n } = useTranslation();
  const numberLocale = resolveLocaleFromLanguage(i18n.language);
  const commandApiRef = useRef<EditableDataGridCommandApi | null>(null);
  const [selectedRow, setSelectedRow] = useState<LocationRow | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationLatitude, setNewLocationLatitude] = useState<string>('');
  const [newLocationLongitude, setNewLocationLongitude] = useState<string>('');
  const [newLocationNotes, setNewLocationNotes] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');

  useCommandContextTag('locations');

  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'locations.create',
      label: 'Neuer Standort (Alt+Shift+N)',
      group: 'navigation',
      keywords: ['standort', 'neu', 'create'],
      shortcutHint: 'Alt+Shift+N',
      keys: { alt: true, shift: true, key: 'n' },
      contextTags: ['locations'],
      isEnabled: () => Boolean(commandApiRef.current),
      action: () => setCreateDialogOpen(true),
    },
    {
      id: 'locations.edit',
      label: 'Standort bearbeiten (Alt+E)',
      group: 'navigation',
      keywords: ['standort', 'bearbeiten', 'edit'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['locations'],
      isEnabled: () => selectedRow !== null,
      action: () => commandApiRef.current?.editSelectedRow(),
    },
    {
      id: 'locations.delete',
      label: 'Standort löschen (Alt+Shift+D)',
      group: 'navigation',
      keywords: ['standort', 'löschen', 'delete'],
      shortcutHint: 'Alt+Shift+D',
      keys: { alt: true, shift: true, key: 'd' },
      contextTags: ['locations'],
      isEnabled: () => selectedRow !== null,
      action: () => commandApiRef.current?.deleteSelectedRow(),
    },
  ], [selectedRow]);

  useRegisterCommands('locations-page', commands);

  const resetCreateDialog = (): void => {
    setNewLocationName('');
    setNewLocationLatitude('');
    setNewLocationLongitude('');
    setNewLocationNotes('');
    setCreateError('');
    setCreateDialogOpen(false);
  };

  const handleCreateLocation = async (): Promise<void> => {
    if (!newLocationName.trim()) {
      setCreateError(t('locations:validation.nameRequired'));
      return;
    }
    const latitude = parseCoordinateInput(newLocationLatitude);
    const longitude = parseCoordinateInput(newLocationLongitude);
    if (newLocationLatitude.trim() && latitude === null) {
      setCreateError(t('locations:validation.coordinateInvalid', { field: t('locations:columns.latitude') }));
      return;
    }
    if (newLocationLongitude.trim() && longitude === null) {
      setCreateError(t('locations:validation.coordinateInvalid', { field: t('locations:columns.longitude') }));
      return;
    }
    if (!validateCoordinateRange(latitude, -90, 90)) {
      setCreateError(t('locations:validation.latitudeRange'));
      return;
    }
    if (!validateCoordinateRange(longitude, -180, 180)) {
      setCreateError(t('locations:validation.longitudeRange'));
      return;
    }

    try {
      await locationAPI.create({
        name: newLocationName.trim(),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        notes: newLocationNotes.trim(),
      });
      resetCreateDialog();
      await commandApiRef.current?.reload();
    } catch {
      setCreateError(t('locations:errors.save'));
    }
  };
  
  //Define columns for the Data Grid with inline editing
  const formatCoordinate = (value: number): string =>
    formatLocalizedNumber(value, numberLocale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });

  const formatCoordinates = (latitude?: number, longitude?: number): string => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return '';
    }
    return `${formatCoordinate(latitude)}; ${formatCoordinate(longitude)}`;
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t('common:fields.name'),
      width: 200,
      editable: true,
      // Validation: name is required
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'coordinates',
      headerName: t('locations:columns.coordinatesLatLon'),
      width: 280,
      editable: false,
      valueGetter: (_value, row) =>
        formatCoordinates(
          typeof row.latitude === 'number' ? row.latitude : undefined,
          typeof row.longitude === 'number' ? row.longitude : undefined,
        ),
      renderCell: (params) => {
        const row = params.row as LocationRow;
        if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') {
          return '—';
        }
        const label = formatCoordinates(row.latitude, row.longitude);
        const href = `https://www.google.com/maps?q=${row.latitude},${row.longitude}`;
        return (
          <Tooltip title={t('locations:tooltips.openInGoogleMaps')} arrow>
            <Box
              component="a"
              href={href}
              target="_blank"
              rel="noreferrer"
              sx={{
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline', textUnderlineOffset: 2 },
              }}
            >
              {label}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      width: 250,
      // Notes field will be overridden by NotesCell in EditableDataGrid
    },
  ];

  return (
    <div className="page-container">
      <Box sx={{ width: 'fit-content', maxWidth: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <h1>{t('locations:title')}</h1>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <PageHelp pageKey="locations" />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              aria-label={`${t('locations:addButton')} (Alt+N)`}
            >
              {t('locations:addButton')}
            </Button>
          </Box>
        </Box>

        <Dialog open={isCreateDialogOpen} onClose={resetCreateDialog} fullWidth maxWidth="sm">
          <DialogTitle>{t('locations:addButton')}</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField
              label={t('common:fields.name')}
              value={newLocationName}
              onChange={(event) => setNewLocationName(event.target.value)}
              error={Boolean(createError)}
              helperText={createError || ' '}
              required
              autoFocus
            />
            <TextField
              label={t('locations:columns.latitude')}
              value={newLocationLatitude}
              onChange={(event) => setNewLocationLatitude(event.target.value)}
              placeholder={t('locations:placeholders.latitude')}
            />
            <TextField
              label={t('locations:columns.longitude')}
              value={newLocationLongitude}
              onChange={(event) => setNewLocationLongitude(event.target.value)}
              placeholder={t('locations:placeholders.longitude')}
            />
            <TextField
              label={t('common:fields.notes')}
              value={newLocationNotes}
              onChange={(event) => setNewLocationNotes(event.target.value)}
              multiline
              minRows={3}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={resetCreateDialog}>{t('common:actions.cancel')}</Button>
            <Button onClick={handleCreateLocation} variant="contained">{t('common:actions.save')}</Button>
          </DialogActions>
        </Dialog>

        <EditableDataGrid<LocationRow>
        columns={columns}
        api={locationAPI as unknown as DataGridAPI<LocationRow>}
        createNewRow={() => ({
          id: -Date.now(),
          name: '',
          latitude: undefined,
          longitude: undefined,
          notes: '',
          isNew: true,
        })}
        mapToRow={(loc) => ({
          ...loc,
          id: loc.id,
          name: loc.name || '',
          latitude: typeof loc.latitude === 'number' ? loc.latitude : undefined,
          longitude: typeof loc.longitude === 'number' ? loc.longitude : undefined,
          notes: loc.notes || '',
        })}
        mapToApiData={(row) => {
          const latitudeValue =
            typeof row.latitude === 'number'
              ? row.latitude
              : parseCoordinateInput(String(row.latitude ?? ''));
          const longitudeValue =
            typeof row.longitude === 'number'
              ? row.longitude
              : parseCoordinateInput(String(row.longitude ?? ''));
          return {
            name: row.name,
            latitude: latitudeValue ?? undefined,
            longitude: longitudeValue ?? undefined,
            notes: row.notes || '',
            ...((row as LocationRow & { project?: number }).project
              ? { project: (row as LocationRow & { project?: number }).project }
              : {}),
          };
        }}
        validateRow={(row) => {
          if (!row.name || row.name.trim() === '') {
            return t('locations:validation.nameRequired');
          }
          const latitudeValue =
            typeof row.latitude === 'number'
              ? row.latitude
              : parseCoordinateInput(String(row.latitude ?? ''));
          const longitudeValue =
            typeof row.longitude === 'number'
              ? row.longitude
              : parseCoordinateInput(String(row.longitude ?? ''));
          if (String(row.latitude ?? '').trim() !== '' && latitudeValue === null) {
            return t('locations:validation.coordinateInvalid', { field: t('locations:columns.latitude') });
          }
          if (String(row.longitude ?? '').trim() !== '' && longitudeValue === null) {
            return t('locations:validation.coordinateInvalid', { field: t('locations:columns.longitude') });
          }
          if (
            latitudeValue !== null &&
            !validateCoordinateRange(latitudeValue, -90, 90)
          ) {
            return t('locations:validation.latitudeRange');
          }
          if (
            longitudeValue !== null &&
            !validateCoordinateRange(longitudeValue, -180, 180)
          ) {
            return t('locations:validation.longitudeRange');
          }
          return null;
        }}
        loadErrorMessage={t('locations:errors.load')}
        saveErrorMessage={t('locations:errors.save')}
        deleteErrorMessage={t('locations:errors.delete')}
        deleteConfirmMessage={t('locations:confirmDelete')}
        addButtonLabel={`${t('locations:addButton')} (Alt+N)`}
        tableKey="locations"
        persistSortInUrl={true}
        showAddAction={false}
        showFooterEditControls={false}
        showRowEditActions={true}
        commandApiRef={commandApiRef}
        onSelectedRowChange={setSelectedRow}
        notes={{
          fields: [
            {
              field: 'notes',
              labelKey: 'common:fields.notes',
            },
          ],
        }}
        />
      </Box>
    </div>
  );
}

export default Locations;
