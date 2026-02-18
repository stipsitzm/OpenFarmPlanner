/**
 * Hierarchical Fields and Beds page component.
 * 
 * Displays Locations > Fields > Beds in a tree structure with inline editing.
 * Uses MUI Data Grid with custom row grouping logic.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The hierarchical Fields/Beds page component
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HierarchyFooter } from '../components/hierarchy/HierarchyFooter';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { DataGrid, GridRowModes } from '@mui/x-data-grid';
import type { GridRowsProp, GridRowModesModel } from '@mui/x-data-grid';
import { Box, Alert } from '@mui/material';
import { dataGridSx } from '../components/data-grid/styles';
import { handleRowEditStop, handleEditableCellClick } from '../components/data-grid/handlers';
import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';
import { useBedOperations } from '../components/hierarchy/hooks/useBedOperations';
import { usePersistentSortModel } from '../hooks/usePersistentSortModel';
import { useFieldOperations } from '../components/hierarchy/hooks/useFieldOperations';
import { fieldAPI, bedAPI } from '../api/api';
import { buildHierarchyRows, type HierarchySortConfig } from '../components/hierarchy/utils/hierarchyUtils';
import { createHierarchyColumns } from '../components/hierarchy/HierarchyColumns';
import { useNotesEditor, NotesDrawer } from '../components/data-grid';
import type { HierarchyRow } from '../components/hierarchy/utils/types';

function FieldsBedsHierarchy(): React.ReactElement {
  const { t } = useTranslation('hierarchy');
  const navigate = useNavigate();
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const hasInitiallyExpandedRef = useRef(false);
  
  // Data fetching
  const { loading, error, setError, locations, fields, beds, setBeds, setFields, fetchData } = useHierarchyData();

  // Debug-Ausgaben NACH allen Hook-Deklarationen
  // Debug-Ausgabe direkt vor DataGrid-Render

  
  // Expansion state
  const { expandedRows, hasPersistedState, toggleExpand, ensureExpanded, expandAll } = useExpandedState('fieldsBedsHierarchy');
  const { sortModel, setSortModel } = usePersistentSortModel({
    tableKey: 'fieldsBedsHierarchy',
    allowedFields: ['name', 'area_sqm'],
    persistInUrl: true,
  });
  const hierarchySortConfig = useMemo<HierarchySortConfig | undefined>(() => {
    const [firstSort] = sortModel;
    if (!firstSort || !firstSort.sort) {
      return undefined;
    }

    return {
      field: firstSort.field,
      direction: firstSort.sort,
    };
  }, [sortModel]);
  
  // Bed operations
  const { addBed, saveBed, deleteBed, pendingEditRow, setPendingEditRow } = useBedOperations(beds, setBeds, setError);
  
  // Field operations
  const { addField, deleteField } = useFieldOperations(locations, setError, fetchData);

  /**
  // Removed duplicate import of useState
   */
  const rows = useMemo<GridRowsProp<HierarchyRow>>(() => {
    return buildHierarchyRows(locations, fields, beds, expandedRows, hierarchySortConfig);
  }, [locations, fields, beds, expandedRows, hierarchySortConfig]);

  // Notes editor - must be after rows definition
  const notesEditor = useNotesEditor<HierarchyRow>({
    rows,
    onSave: async ({ row, value }) => {
      if (!row.name) {
        throw new Error(t('validation.nameRequired'));
      }

      const parsedArea = parseAreaValue(row.area_sqm);
      
      if (row.type === 'bed' && row.bedId) {
        // Save bed with notes
        await bedAPI.update(row.bedId, {
          name: row.name,
          field: row.field!,
          area_sqm: parsedArea,
          notes: value,
        });
        
        // Update local state
        setBeds(prev => prev.map(b => 
          b.id === row.bedId ? { ...b, notes: value } : b
        ));
      } else if (row.type === 'field' && row.fieldId) {
        // Save field with notes
        await fieldAPI.update(row.fieldId, {
          name: row.name,
          location: row.locationId!,
          area_sqm: parsedArea,
          notes: value,
        });
        
        // Update local state
        setFields(prev => prev.map(f => 
          f.id === row.fieldId ? { ...f, notes: value } : f
        ));
      }
      // Note: locations don't have notes in this hierarchy
    },
    onError: setError,
  });

  /**
   * Expand all rows when data is loaded (only once on initial load)
   */
  useEffect(() => {
    if (!hasPersistedState && !hasInitiallyExpandedRef.current && locations.length > 0 && fields.length > 0) {
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
      hasInitiallyExpandedRef.current = true;
    }
  }, [expandAll, fields, hasPersistedState, locations]);

  /**
   * Handle pending edit mode after rows are updated
   */
  useEffect(() => {
    if (pendingEditRow !== null) {
      // Check if the row exists in the current rows
      const rowExists = rows.some(r => r.id === pendingEditRow);
      if (rowExists) {
        const rowId = pendingEditRow;
        setTimeout(() => {
          setRowModesModel((oldModel) => ({
            ...oldModel,
            [rowId]: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
          }));
          setPendingEditRow(null);
        }, 0);
      }
    }
  }, [rows, pendingEditRow, setPendingEditRow]);

  const handleAddBed = useCallback((fieldId: number): void => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const fieldKey = `field-${fieldId}`;
    ensureExpanded(fieldKey);

    const newBedId = addBed(fieldId);

    setPendingEditRow(newBedId); //will be applied after re-render
  }, [addBed, ensureExpanded, fields, setPendingEditRow]);

  const handleCreatePlantingPlan = useCallback((bedId: number): void => {
    navigate(`/planting-plans?bedId=${bedId}`);
  }, [navigate]);

  const parseAreaValue = (value: number | string | undefined): number | undefined => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };

  const getBedAreaSum = (fieldId: number, excludeBedId?: number, overrideArea?: number) => {
    const filteredBeds = beds.filter(b => b.field === fieldId && b.id !== excludeBedId);
    const bedAreas = filteredBeds.map(b => {
      if (typeof b.area_sqm === 'number') return b.area_sqm;
      if (typeof b.area_sqm === 'string') return Number.parseFloat(b.area_sqm);
      return NaN;
    });
    const sum = bedAreas.reduce((sum, area) => sum + (Number.isFinite(area) ? area : 0), 0)
      + (typeof overrideArea === 'number' ? overrideArea : 0);
    return sum;
  };

  const processRowUpdate = async (newRow: HierarchyRow): Promise<HierarchyRow> => {
    // Name muss immer gesetzt sein
    if (!newRow.name || newRow.name.trim() === '') {
      setError(t('validation.nameRequired'));
      throw new Error(t('validation.nameRequired'));
    }

    // Flächenwert muss > 0 sein
    const areaValue = typeof newRow.area_sqm === 'number'
      ? newRow.area_sqm
      : typeof newRow.area_sqm === 'string'
        ? Number.parseFloat(newRow.area_sqm)
        : NaN;
    if (areaValue <= 0 || isNaN(areaValue)) {
      setError(t('validation.areaMustBePositive'));
      throw new Error(t('validation.areaMustBePositive'));
    }

    // ...existing code...

    // Validierung: Summe der Beetflächen darf Feldfläche nicht überschreiten
    if (newRow.type === 'bed') {
      const field = fields.find(f => f.id === newRow.field);
      if (field) {
        const fieldArea = typeof field.area_sqm === 'number'
          ? field.area_sqm
          : typeof field.area_sqm === 'string'
            ? Number.parseFloat(field.area_sqm)
            : NaN;
        const bedArea = typeof newRow.area_sqm === 'number'
          ? newRow.area_sqm
          : typeof newRow.area_sqm === 'string'
            ? Number.parseFloat(newRow.area_sqm)
            : NaN;
        const sum = getBedAreaSum(field.id!, newRow.bedId, bedArea);
        // ...existing code...
        if (sum > fieldArea) {
          const sumStr = sum.toFixed(2);
          const maxStr = fieldArea.toFixed(2);
          setError(t('validation.bedAreaExceedsField', { sum: sumStr, max: maxStr }));
          throw new Error(t('validation.bedAreaExceedsField', { sum: sumStr, max: maxStr }));
        }
      }
      const savedBed = await saveBed({
        id: newRow.bedId!,
        name: newRow.name,
        field: newRow.field!,
        area_sqm: parseAreaValue(newRow.area_sqm),
        notes: newRow.notes,
      });
      return { ...newRow, id: savedBed.id!, bedId: savedBed.id!, isNew: false };
    } else if (newRow.type === 'field') {
      // Validierung: Summe der Beetflächen darf neue Feldfläche nicht überschreiten
      const fieldArea = typeof newRow.area_sqm === 'number'
        ? newRow.area_sqm
        : typeof newRow.area_sqm === 'string'
          ? Number.parseFloat(newRow.area_sqm)
          : NaN;
      const sum = getBedAreaSum(newRow.fieldId!);
      // ...existing code...
      if (sum > fieldArea) {
        const sumStr = sum.toFixed(2);
        const maxStr = fieldArea.toFixed(2);
        setError(t('validation.bedAreaExceedsField', { sum: sumStr, max: maxStr }));
        throw new Error(t('validation.bedAreaExceedsField', { sum: sumStr, max: maxStr }));
      }
      try {
        // Update Field via API
        const updated = await fieldAPI.update(newRow.fieldId!, {
          name: newRow.name,
          location: newRow.locationId!,
          area_sqm: parseAreaValue(newRow.area_sqm),
          notes: newRow.notes,
        });
        // ...existing code...
        // Aktualisiere lokalen State direkt (optional, für sofortiges Feedback)
        const updatedArea = typeof updated.data.area_sqm === 'number'
          ? updated.data.area_sqm
          : updated.data.area_sqm
            ? Number.parseFloat(updated.data.area_sqm)
            : undefined;

        setFields((prevFields) => prevFields.map(f => {
          if (f.id === newRow.fieldId) {
            // Merge API-Daten, id bleibt Zahl, area_sqm als Zahl
            return {
              ...f,
              ...updated.data,
              id: updated.data.id,
              fieldId: updated.data.id,
              area_sqm: updatedArea,
            };
          }
          return f;
        }));
        // Frische Felder nach Update neu laden
        await fetchData();
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
      handleCreatePlantingPlan,
      notesEditor.handleOpen,
      t
    );
  }, [toggleExpand, handleAddBed, deleteBed, addField, deleteField, handleCreatePlantingPlan, notesEditor.handleOpen, t]);

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
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          slots={{
            footer: () => <HierarchyFooter locations={locations} onAddField={addField} />,
          }}
          isRowSelectable={(params) => params.row.type === 'bed'}
          isCellEditable={(params) => params.row.type === 'bed' || params.row.type === 'field'}
          sx={dataGridSx}
          onCellClick={(params) => handleEditableCellClick(params, rowModesModel, setRowModesModel)}
        />
      </Box>

      {/* Notes Editor Drawer */}
      <NotesDrawer
        open={notesEditor.isOpen}
        title="Notizen"
        value={notesEditor.draft}
        onChange={notesEditor.setDraft}
        onSave={notesEditor.handleSave}
        onClose={notesEditor.handleClose}
        loading={notesEditor.isSaving}
      />
    </div>
  );
}

export default FieldsBedsHierarchy;
