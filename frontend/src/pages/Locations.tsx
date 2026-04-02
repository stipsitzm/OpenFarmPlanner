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
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from '../i18n';
import { locationAPI, type Location } from '../api/api';
import { EditableDataGrid, type EditableDataGridCommandApi, type EditableRow, type DataGridAPI } from '../components/data-grid';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import type { CommandSpec } from '../commands/types';

interface LocationRow extends Location, EditableRow {
  id: number;
  isNew?: boolean;
}

function Locations(): React.ReactElement {
  const { t } = useTranslation(['locations', 'common']);
  const commandApiRef = useRef<EditableDataGridCommandApi | null>(null);
  const [selectedRow, setSelectedRow] = useState<LocationRow | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationAddress, setNewLocationAddress] = useState<string>('');
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
    setNewLocationAddress('');
    setNewLocationNotes('');
    setCreateError('');
    setCreateDialogOpen(false);
  };

  const handleCreateLocation = async (): Promise<void> => {
    if (!newLocationName.trim()) {
      setCreateError(t('locations:validation.nameRequired'));
      return;
    }

    try {
      await locationAPI.create({
        name: newLocationName.trim(),
        address: newLocationAddress.trim(),
        notes: newLocationNotes.trim(),
      });
      resetCreateDialog();
      await commandApiRef.current?.reload();
    } catch {
      setCreateError(t('locations:errors.save'));
    }
  };
  
  //Define columns for the Data Grid with inline editing
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
      field: 'address',
      headerName: t('common:fields.address'),
      width: 300,
      editable: true,
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            aria-label={`${t('locations:addButton')} (Alt+N)`}
          >
            {t('locations:addButton')}
          </Button>
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
              label={t('common:fields.address')}
              value={newLocationAddress}
              onChange={(event) => setNewLocationAddress(event.target.value)}
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
          address: '',
          notes: '',
          isNew: true,
        })}
        mapToRow={(loc) => ({
          ...loc,
          id: loc.id,
          name: loc.name || '',
          address: loc.address || '',
          notes: loc.notes || '',
        })}
        mapToApiData={(row) => ({
          name: row.name,
          address: row.address || '',
          notes: row.notes || '',
          ...((row as LocationRow & { project?: number }).project
            ? { project: (row as LocationRow & { project?: number }).project }
            : {}),
        })}
        validateRow={(row) => {
          if (!row.name || row.name.trim() === '') {
            return t('locations:validation.nameRequired');
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
