/**
 * Hierarchical Fields and Beds page component.
 * 
 * Displays Locations > Fields > Beds in a tree structure with inline editing.
 * Uses MUI Data Grid with custom row grouping logic.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The hierarchical Fields/Beds page component
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { useFieldOperations } from '../components/hierarchy/hooks/useFieldOperations';
import { fieldAPI, bedAPI } from '../api/api';
import { buildHierarchyRows } from '../components/hierarchy/utils/hierarchyUtils';
import { createHierarchyColumns } from '../components/hierarchy/HierarchyColumns';
import { useNotesEditor, NotesDrawer } from '../components/data-grid';
import type { HierarchyRow } from '../components/hierarchy/utils/types';

function FieldsBedsHierarchy(): React.ReactElement {
  const { t } = useTranslation('hierarchy');
  const navigate = useNavigate();
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [hasInitiallyExpanded, setHasInitiallyExpanded] = useState(false);
  
  // Data fetching
  const { loading, error, setError, locations, fields, beds, setBeds, setFields, fetchData } = useHierarchyData();

  // Debug-Ausgaben NACH allen Hook-Deklarationen
  // Debug-Ausgabe direkt vor DataGrid-Render

  
  // Expansion state
  const { expandedRows, toggleExpand, ensureExpanded, expandAll } = useExpandedState();
  
  // Bed operations
  const { addBed, saveBed, deleteBed, pendingEditRow, setPendingEditRow } = useBedOperations(beds, setBeds, setError);
  
  // Field operations
  const { addField, deleteField } = useFieldOperations(locations, setError, fetchData);

  // Notes editor
  const notesEditor = useNotesEditor<HierarchyRow>({
    rows,
    onSave: async ({ row, field, value }) => {
      // Update the row with the new notes value
      const updatedRow = { ...row, [field]: value };
      
      if (row.type === 'bed' && row.bedId) {
        // Save bed with notes
        await bedAPI.update(row.bedId, {
          name: row.name,
          field: row.field!,
          area_sqm: row.area_sqm,
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
          area_sqm: row.area_sqm,
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
  // Removed duplicate import of useState
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

  const handleAddBed = (fieldId: number): void => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const fieldKey = `field-${fieldId}`;
    ensureExpanded(fieldKey);

    const newBedId = addBed(fieldId);

    setPendingEditRow(newBedId); //will be applied after re-render
  };

  const handleCreatePlantingPlan = (bedId: number): void => {
    navigate(`/planting-plans?bedId=${bedId}`);
  };

  const getBedAreaSum = (fieldId: number, excludeBedId?: number, overrideArea?: number) => {
    const filteredBeds = beds.filter(b => b.field === fieldId && b.id !== excludeBedId);
    const bedAreas = filteredBeds.map(b => typeof b.area_sqm === 'number' ? b.area_sqm : parseFloat(b.area_sqm as any));
    const sum = bedAreas.reduce((sum, area) => sum + (typeof area === 'number' ? area : 0), 0) + (typeof overrideArea === 'number' ? overrideArea : parseFloat(overrideArea as any) || 0);
    return sum;
  };

  const processRowUpdate = async (newRow: HierarchyRow): Promise<HierarchyRow> => {
    // Name muss immer gesetzt sein
    if (!newRow.name || newRow.name.trim() === '') {
      setError(t('validation.nameRequired'));
      throw new Error(t('validation.nameRequired'));
    }

    // Flächenwert muss > 0 sein
    const areaValue = typeof newRow.area_sqm === 'number' ? newRow.area_sqm : parseFloat(newRow.area_sqm as any);
    if (areaValue <= 0 || isNaN(areaValue)) {
      setError(t('validation.areaMustBePositive'));
      throw new Error(t('validation.areaMustBePositive'));
    }

    // ...existing code...

    // Validierung: Summe der Beetflächen darf Feldfläche nicht überschreiten
    if (newRow.type === 'bed') {
      const field = fields.find(f => f.id === newRow.field);
      if (field) {
        const fieldArea = typeof field.area_sqm === 'number' ? field.area_sqm : parseFloat(field.area_sqm as any);
        const bedArea = typeof newRow.area_sqm === 'number' ? newRow.area_sqm : parseFloat(newRow.area_sqm as any);
        const sum = getBedAreaSum(field.id!, newRow.bedId, bedArea);
        // ...existing code...
        if (sum > fieldArea) {
          const sumStr = sum.toFixed(2);
          const maxStr = fieldArea.toFixed(2);
          setError(t('validation.bedAreaExceedsField', { sum: sumStr, max: maxStr }));
          throw new Error(t('validation.bedAreaExceedsField', { sum: sumStr, max: maxStr }));
        }
      }
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
      // Validierung: Summe der Beetflächen darf neue Feldfläche nicht überschreiten
      const fieldArea = typeof newRow.area_sqm === 'number' ? newRow.area_sqm : parseFloat(newRow.area_sqm as any);
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
          area_sqm: newRow.area_sqm,
          notes: newRow.notes,
        });
        // ...existing code...
        // Aktualisiere lokalen State direkt (optional, für sofortiges Feedback)
        setFields((prevFields) => prevFields.map(f => {
          if (f.id === newRow.fieldId) {
            // Merge API-Daten, id bleibt Zahl, area_sqm als Zahl
            return {
              ...f,
              ...updated.data,
              id: updated.data.id,
              fieldId: updated.data.id,
              area_sqm: updated.data.area_sqm !== undefined ? parseFloat(updated.data.area_sqm) : undefined,
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
  }, [toggleExpand, handleAddBed, deleteBed, addField, deleteField, notesEditor.handleOpen, t]);

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
