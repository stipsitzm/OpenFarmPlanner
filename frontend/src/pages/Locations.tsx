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
import { useTranslation } from '../i18n';
import { locationAPI, type Location } from '../api/api';
import { EditableDataGrid, type EditableDataGridCommandApi, type EditableRow, type DataGridAPI } from '../components/data-grid';
import { useCommandContextTag, useRegisterCommands } from '../commands/CommandProvider';
import type { CommandSpec } from '../commands/types';

interface LocationRow extends Location, EditableRow {
  id: number;
  isNew?: boolean;
}

function Locations(): React.ReactElement {
  const { t } = useTranslation(['locations', 'common']);
  const commandApiRef = useRef<EditableDataGridCommandApi | null>(null);
  const [selectedRow, setSelectedRow] = useState<LocationRow | null>(null);

  useCommandContextTag('locations');

  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'locations.create',
      title: 'Neuer Standort (Alt+N)',
      keywords: ['standort', 'neu', 'create'],
      shortcutHint: 'Alt+N',
      keys: { alt: true, key: 'n' },
      contextTags: ['locations'],
      isAvailable: () => Boolean(commandApiRef.current),
      run: () => commandApiRef.current?.addRow(),
    },
    {
      id: 'locations.edit',
      title: 'Standort bearbeiten (Alt+E)',
      keywords: ['standort', 'bearbeiten', 'edit'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['locations'],
      isAvailable: () => selectedRow !== null,
      run: () => commandApiRef.current?.editSelectedRow(),
    },
    {
      id: 'locations.delete',
      title: 'Standort löschen (Alt+Shift+D)',
      keywords: ['standort', 'löschen', 'delete'],
      shortcutHint: 'Alt+Shift+D',
      keys: { alt: true, shift: true, key: 'd' },
      contextTags: ['locations'],
      isAvailable: () => selectedRow !== null,
      run: () => commandApiRef.current?.deleteSelectedRow(),
    },
  ], [selectedRow]);

  useRegisterCommands('locations-page', commands);
  
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
      <h1>{t('locations:title')}</h1>
      
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
    </div>
  );
}

export default Locations;
