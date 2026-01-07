/**
 * Hierarchical Fields and Beds page component.
 * 
 * Displays Locations > Fields > Beds in a tree structure with inline editing.
 * Uses MUI Data Grid with custom row grouping logic.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The hierarchical Fields/Beds page component
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { DataGrid, GridRowModes } from '@mui/x-data-grid';
import type { GridRowsProp, GridRowModesModel } from '@mui/x-data-grid';
import { Box, Alert } from '@mui/material';
import { dataGridSx } from '../components/data-grid/styles';
import { handleRowEditStop, handleEditableCellClick } from '../components/data-grid/handlers';
import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';
import { useBedOperations } from '../components/hierarchy/hooks/useBedOperations';
import { useFieldOperations } from '../components/hierarchy/hooks/useFieldOperations';
import { fieldAPI } from '../api/api';
import { buildHierarchyRows } from '../components/hierarchy/utils/hierarchyUtils';
import { createHierarchyColumns } from '../components/hierarchy/HierarchyColumns';
import { HierarchyFooter } from '../components/hierarchy/HierarchyFooter';
import type { HierarchyRow } from '../components/hierarchy/utils/types';

function FieldsBedsHierarchy(): React.ReactElement {
  const { t } = useTranslation('hierarchy');
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [hasInitiallyExpanded, setHasInitiallyExpanded] = useState(false);
  
  // Data fetching
  const { loading, error, setError, locations, fields, beds, setBeds, fetchData } = useHierarchyData();
  
  // Expansion state
  const { expandedRows, toggleExpand, ensureExpanded, expandAll } = useExpandedState();
  
  // Bed operations
  const { addBed, saveBed, deleteBed, pendingEditRow, setPendingEditRow } = useBedOperations(beds, setBeds, setError);
  
  // Field operations
  const { addField, deleteField } = useFieldOperations(locations, setError, fetchData);

  /**
   * Build hierarchy from flat data
   */
  const rows = useMemo<GridRowsProp<HierarchyRow>>(() => {
    return buildHierarchyRows(locations, fields, beds, expandedRows);
  }, [locations, fields, beds, expandedRows]);

  /**
   * Expand all rows when data is loaded (only once on initial load)
   */
  useEffect(() => {
    if (!hasInitiallyExpanded && locations.length > 0 && fields.length > 0) {
      const allRowIds = new Set<string | number>();
      
      // Add all location IDs
      locations.forEach(location => {
        allRowIds.add(`location-${location.id}`);
      });
      
      // Add all field IDs
      fields.forEach(field => {
        allRowIds.add(`field-${field.id}`);
      });
      
      expandAll(Array.from(allRowIds));
      setHasInitiallyExpanded(true);
    }
  }, [hasInitiallyExpanded, locations.length, fields.length]);

  /**
   * Handle pending edit mode after rows are updated
   */
  useEffect(() => {
    if (pendingEditRow !== null) {
      // Check if the row exists in the current rows
      const rowExists = rows.some(r => r.id === pendingEditRow);
      if (rowExists) {
        setRowModesModel((oldModel) => ({
          ...oldModel,
          [pendingEditRow]: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
        }));
        setPendingEditRow(null);
      }
    }
  }, [rows, pendingEditRow]);

  /**
   * Handle adding a new bed
   */
  const handleAddBed = (fieldId: number): void => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    // Ensure field is expanded
    const fieldKey = `field-${fieldId}`;
    ensureExpanded(fieldKey);

    // Add bed and get ID
    const newBedId = addBed(fieldId);

    // Set pending edit mode for the new bed (will be applied after re-render)
    setPendingEditRow(newBedId);
  };



  /**
   * Process row update - save bed to API
   */
  const processRowUpdate = async (newRow: HierarchyRow): Promise<HierarchyRow> => {
    // Name muss immer gesetzt sein
    if (!newRow.name || newRow.name.trim() === '') {
      setError(t('validation.nameRequired'));
      throw new Error(t('validation.nameRequired'));
    }

    if (newRow.type === 'bed') {
      try {
        const savedBed = await saveBed({
          id: newRow.bedId!,
          name: newRow.name,
          field: newRow.field!,
          area_sqm: newRow.area_sqm,
          notes: newRow.notes,
        });
        return { ...newRow, id: savedBed.id!, bedId: savedBed.id!, isNew: false };
      } catch (err) {
        throw err;
      }
    } else if (newRow.type === 'field') {
      try {
        // Update Field via API
        const updated = await fieldAPI.update(newRow.fieldId!, {
          name: newRow.name,
          location: newRow.locationId!,
          area_sqm: newRow.area_sqm,
          notes: newRow.notes,
        });
        return { ...newRow, name: updated.data.name, area_sqm: updated.data.area_sqm, notes: updated.data.notes };
      } catch (err) {
        setError(t('errors.save'));
        throw err;
      }
    }
    return newRow;
  };

  /**
   * Handle row update errors
   */
  const handleProcessRowUpdateError = (error: Error): void => {
    console.error('Row update error:', error);
    setError(error.message || t('errors.save'));
  };

  /**
   * Create columns with callbacks
   */
  const columns = useMemo(() => {
    return createHierarchyColumns(
      toggleExpand,
      handleAddBed,
      (bedId) => deleteBed(bedId),
      (locationId) => addField(locationId),
      (fieldId) => deleteField(fieldId),
      t
    );
  }, [toggleExpand, handleAddBed, deleteBed, addField, deleteField, t]);

  return (
    <div className="page-container">
      <h1>{t('title')}</h1>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowModesModel={rowModesModel}
          onRowModesModelChange={setRowModesModel}
          onRowEditStop={handleRowEditStop}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
          loading={loading}
          editMode="row"
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
          slots={{
            footer: () => <HierarchyFooter locations={locations} onAddField={addField} />,
          }}
          isRowSelectable={(params) => params.row.type === 'bed'}
          isCellEditable={(params) => params.row.type === 'bed' || params.row.type === 'field'}
          sx={dataGridSx}
          onCellClick={(params) => handleEditableCellClick(params, rowModesModel, setRowModesModel)}
        />
      </Box>
    </div>
  );
}

export default FieldsBedsHierarchy;
