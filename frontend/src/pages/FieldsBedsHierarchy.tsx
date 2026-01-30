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
import { fieldAPI } from '../api/api';
import { buildHierarchyRows } from '../components/hierarchy/utils/hierarchyUtils';
import { createHierarchyColumns } from '../components/hierarchy/HierarchyColumns';

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
    console.log('[DEBUG] getBedAreaSum:', { fieldId, excludeBedId, overrideArea, bedAreas, sum });
    return sum;
  };

  const processRowUpdate = async (newRow: HierarchyRow): Promise<HierarchyRow> => {
    // Name muss immer gesetzt sein
    if (!newRow.name || newRow.name.trim() === '') {
      setError(t('validation.nameRequired'));
      throw new Error(t('validation.nameRequired'));
    }

    // Debug: Zeige neuen Row-Wert im Update
    if (newRow.type === 'field') {
      console.log('[DEBUG] processRowUpdate: Field update attempt', newRow);
    }

    // Validierung: Summe der Beetflächen darf Feldfläche nicht überschreiten
    if (newRow.type === 'bed') {
      const field = fields.find(f => f.id === newRow.field);
      if (field) {
        const fieldArea = typeof field.area_sqm === 'number' ? field.area_sqm : parseFloat(field.area_sqm as any);
        const bedArea = typeof newRow.area_sqm === 'number' ? newRow.area_sqm : parseFloat(newRow.area_sqm as any);
        const sum = getBedAreaSum(field.id!, newRow.bedId, bedArea);
        console.log('[DEBUG] Summenprüfung (bed):', { sum, fieldArea, bedArea, typeofFieldArea: typeof fieldArea, typeofBedArea: typeof bedArea });
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
      console.log('[DEBUG] Summenprüfung (field):', { sum, fieldArea, typeofFieldArea: typeof fieldArea });
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
        console.log('[DEBUG] API response for field update', updated.data);
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
      t
    );
  }, [toggleExpand, handleAddBed, deleteBed, addField, deleteField, t]);

  return (
    <div className="page-container">
      <h1>{t('title')}</h1>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Box sx={{ width: '100%' }}>
        {console.log('[DEBUG] Render rows', rows)}
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
