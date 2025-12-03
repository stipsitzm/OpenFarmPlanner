/**
 * Hierarchical Fields and Beds page component.
 * 
 * Displays Locations > Fields > Beds in a tree structure with inline editing.
 * Uses MUI Data Grid with custom row grouping logic.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The hierarchical Fields/Beds page component
 */

import { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridRowModes, GridRowEditStopReasons } from '@mui/x-data-grid';
import type { GridColDef, GridRowsProp, GridRowModesModel, GridEventListener, GridRowId, GridRenderCellParams } from '@mui/x-data-grid';
import { Box, Alert, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import { locationAPI, fieldAPI, bedAPI, type Location, type Field, type Bed } from '../api/client';

/**
 * Combined row type for hierarchy
 */
interface HierarchyRow {
  id: string | number;
  type: 'location' | 'field' | 'bed';
  level: number;
  expanded?: boolean;
  parentId?: string | number;
  // Bed fields
  name?: string;
  field?: number;
  field_name?: string;
  length_m?: number;
  width_m?: number;
  notes?: string;
  // Location/Field metadata
  locationId?: number;
  fieldId?: number;
  bedId?: number;
  isNew?: boolean;
}

function FieldsBedsHierarchy(): React.ReactElement {
  const [rows, setRows] = useState<GridRowsProp<HierarchyRow>>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const [pendingEditRow, setPendingEditRow] = useState<number | null>(null);

  /**
   * Fetch all data from APIs
   */
  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [locationsRes, fieldsRes, bedsRes] = await Promise.all([
        locationAPI.list(),
        fieldAPI.list(),
        bedAPI.list(),
      ]);
      
      setLocations(locationsRes.data.results.filter(l => l.id !== undefined));
      setFields(fieldsRes.data.results.filter(f => f.id !== undefined));
      setBeds(bedsRes.data.results.filter(b => b.id !== undefined));
      setError('');
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Build hierarchy from flat data
   */
  useEffect(() => {
    const hierarchyRows: HierarchyRow[] = [];

    // Check if we have multiple locations
    const hasMultipleLocations = locations.length > 1;

    if (hasMultipleLocations) {
      // Show locations as top level
      locations.forEach(location => {
        const locationKey = `location-${location.id}`;
        const isExpanded = expandedRows.has(locationKey);
        hierarchyRows.push({
          id: locationKey,
          type: 'location',
          level: 0,
          name: location.name,
          locationId: location.id,
          expanded: isExpanded,
        });

        // Add fields under this location
        const locationFields = fields.filter(f => f.location === location.id);
        locationFields.forEach(field => {
          const fieldKey = `field-${field.id}`;
          const isFieldExpanded = expandedRows.has(fieldKey);
          hierarchyRows.push({
            id: fieldKey,
            type: 'field',
            level: 1,
            name: field.name,
            parentId: locationKey,
            locationId: location.id,
            fieldId: field.id,
            expanded: isFieldExpanded,
          });

          // Add beds under this field
          const fieldBeds = beds.filter(b => b.field === field.id);
          fieldBeds.forEach(bed => {
            hierarchyRows.push({
              id: bed.id!,
              type: 'bed',
              level: 2,
              parentId: fieldKey,
              name: bed.name,
              field: bed.field,
              field_name: field.name,
              length_m: bed.length_m,
              width_m: bed.width_m,
              notes: bed.notes,
              locationId: location.id,
              fieldId: field.id,
              bedId: bed.id,
              isNew: bed.id! < 0, // Mark as new if ID is negative
            });
          });
        });
      });
    } else {
      // Single location or no location - show fields as top level
      fields.forEach(field => {
        const fieldKey = `field-${field.id}`;
        const isFieldExpanded = expandedRows.has(fieldKey);
        hierarchyRows.push({
          id: fieldKey,
          type: 'field',
          level: 0,
          name: field.name,
          fieldId: field.id,
          expanded: isFieldExpanded,
        });

        // Add beds under this field
        const fieldBeds = beds.filter(b => b.field === field.id);
        fieldBeds.forEach(bed => {
          hierarchyRows.push({
            id: bed.id!,
            type: 'bed',
            level: 1,
            parentId: fieldKey,
            name: bed.name,
            field: bed.field,
            field_name: field.name,
            length_m: bed.length_m,
            width_m: bed.width_m,
            notes: bed.notes,
            fieldId: field.id,
            bedId: bed.id,
            isNew: bed.id! < 0, // Mark as new if ID is negative
          });
        });
      });
    }

    setRows(hierarchyRows);
  }, [locations, fields, beds, expandedRows]);

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
   * Toggle row expansion
   */
  const handleToggleExpand = (rowId: GridRowId) => {
    setExpandedRows((prevExpanded) => {
      const newExpanded = new Set(prevExpanded);
      if (newExpanded.has(rowId)) {
        newExpanded.delete(rowId);
      } else {
        newExpanded.add(rowId);
      }
      return newExpanded;
    });
  };

  /**
   * Filter rows based on expansion state
   */
  const getVisibleRows = (): HierarchyRow[] => {
    const visible: HierarchyRow[] = [];
    const expandedIds = new Set(rows.filter(r => r.expanded).map(r => r.id));

    rows.forEach(row => {
      if (row.level === 0) {
        // Top level always visible
        visible.push(row);
      } else if (row.parentId && expandedIds.has(row.parentId)) {
        // Check if parent is expanded
        const parent = rows.find(r => r.id === row.parentId);
        if (parent && parent.expanded) {
          if (row.level === 1) {
            visible.push(row);
          } else if (row.level === 2) {
            // For beds, check if field parent is also expanded
            visible.push(row);
          }
        }
      }
    });

    return visible;
  };

  /**
   * Handle adding a new bed
   */
  const handleAddBed = (fieldId: number): void => {
    const newBedId = -Date.now();
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const newBed: Bed = {
      id: newBedId,
      name: '',
      field: fieldId,
      length_m: undefined,
      width_m: undefined,
      notes: '',
    };

    // Ensure field is expanded
    const fieldKey = `field-${fieldId}`;
    setExpandedRows((prev) => {
      const newExpanded = new Set(prev);
      newExpanded.add(fieldKey);
      return newExpanded;
    });

    // Add temporary bed to beds state
    setBeds((prevBeds) => [newBed, ...prevBeds]);

    // Set pending edit mode for the new bed (will be applied after re-render)
    setPendingEditRow(newBedId);
  };

  /**
   * Handle adding a new field
   */
  const handleAddField = async (locationId?: number): Promise<void> => {
    // Use first location if not specified
    const targetLocationId = locationId || (locations.length > 0 ? locations[0].id : undefined);
    if (!targetLocationId) {
      setError('Bitte erstellen Sie zuerst einen Standort');
      return;
    }

    const fieldName = window.prompt('Name des neuen Schlags:');
    if (!fieldName || fieldName.trim() === '') {
      return; // User cancelled or entered empty name
    }

    try {
      await fieldAPI.create({
        name: fieldName.trim(),
        location: targetLocationId,
        area_sqm: undefined,
        notes: '',
      });
      
      // Reload all data to get the new field
      await fetchData();
      setError('');
    } catch (err) {
      setError('Fehler beim Erstellen des Schlags');
      console.error('Error creating field:', err);
    }
  };

  /**
   * Handle field deletion
   */
  const handleDeleteField = (fieldId: number) => (): void => {
    if (!window.confirm('Möchten Sie diesen Schlag wirklich löschen? Alle zugehörigen Beete werden ebenfalls gelöscht.')) return;

    if (fieldId < 0) {
      // Remove unsaved field
      setFields(prev => prev.filter(f => f.id !== fieldId));
      return;
    }

    fieldAPI.delete(fieldId)
      .then(() => {
        fetchData();
        setError('');
      })
      .catch((err) => {
        setError('Fehler beim Löschen des Schlags');
        console.error('Error deleting field:', err);
      });
  };

  /**
   * Handle row edit stop event
   */
  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event): void => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  /**
   * Process row update - save bed to API
   */
  const processRowUpdate = async (newRow: HierarchyRow): Promise<HierarchyRow> => {
    // Only beds are editable
    if (newRow.type !== 'bed') return newRow;

    // Validate
    if (!newRow.name || newRow.name.trim() === '') {
      setError('Name ist ein Pflichtfeld');
      throw new Error('Name ist ein Pflichtfeld');
    }

    try {
      const bedData = {
        name: newRow.name,
        field: newRow.field!,
        length_m: newRow.length_m,
        width_m: newRow.width_m,
        notes: newRow.notes || '',
      };

      if (newRow.isNew) {
        // Create new bed
        const response = await bedAPI.create(bedData);
        setError('');
        
        // Remove temporary bed and add saved bed to state
        setBeds((prevBeds) => {
          const filteredBeds = prevBeds.filter(b => b.id !== newRow.bedId);
          return [response.data, ...filteredBeds];
        });
        
        return { ...newRow, id: response.data.id!, bedId: response.data.id!, isNew: false };
      } else {
        // Update existing bed
        const response = await bedAPI.update(newRow.bedId!, bedData);
        setError('');
        
        // Update bed in state
        setBeds((prevBeds) => 
          prevBeds.map(b => b.id === newRow.bedId ? response.data : b)
        );
        
        return { ...newRow, ...response.data };
      }
    } catch (err) {
      setError('Fehler beim Speichern des Beets');
      console.error('Error saving bed:', err);
      throw err;
    }
  };

  /**
   * Handle row update errors
   */
  const handleProcessRowUpdateError = (error: Error): void => {
    console.error('Row update error:', error);
    setError(error.message || 'Fehler beim Speichern');
  };

  /**
   * Handle bed deletion
   */
  const handleDeleteBed = (bedId: number) => (): void => {
    if (!window.confirm('Möchten Sie dieses Beet wirklich löschen?')) return;

    if (bedId < 0) {
      // Remove unsaved bed from state
      setBeds((prevBeds) => prevBeds.filter((bed) => bed.id !== bedId));
      return;
    }

    bedAPI.delete(bedId)
      .then(() => {
        // Remove bed from state
        setBeds((prevBeds) => prevBeds.filter((bed) => bed.id !== bedId));
        setError('');
      })
      .catch((err) => {
        setError('Fehler beim Löschen des Beets');
        console.error('Error deleting bed:', err);
      });
  };

  /**
   * Render cell with expansion controls
   */
  const renderNameCell = (params: GridRenderCellParams<HierarchyRow>) => {
    const row = params.row;
    const indent = row.level * 24;

    if (row.type === 'location' || row.type === 'field') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', pl: `${indent}px` }}>
          <IconButton
            size="small"
            onClick={() => handleToggleExpand(row.id)}
            sx={{ mr: 1 }}
          >
            {row.expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
          <FolderIcon sx={{ mr: 1, color: 'action.active' }} />
          <span style={{ fontWeight: row.type === 'location' ? 'bold' : 'normal' }}>
            {row.name}
          </span>
        </Box>
      );
    }

    // Bed row
    return (
      <Box sx={{ pl: `${indent}px` }}>
        {params.value}
      </Box>
    );
  };

  /**
   * Define columns
   */
  const columns: GridColDef<HierarchyRow>[] = [
    {
      field: 'name',
      headerName: 'Name',
      width: 300,
      editable: true,
      renderCell: renderNameCell,
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'length_m',
      headerName: 'Länge (m)',
      width: 120,
      type: 'number',
      editable: true,
    },
    {
      field: 'width_m',
      headerName: 'Breite (m)',
      width: 120,
      type: 'number',
      editable: true,
    },
    {
      field: 'notes',
      headerName: 'Notizen',
      width: 300,
      editable: true,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Aktionen',
      width: 150,
      getActions: ({ row }) => {
        if (row.type === 'bed') {
          return [
            <button
              key="delete"
              onClick={handleDeleteBed(row.bedId!)}
              style={{
                color: '#d32f2f',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '0.8125rem',
              }}
            >
              Löschen
            </button>,
          ];
        } else if (row.type === 'field') {
          return [
            <button
              key="add-bed"
              onClick={() => handleAddBed(row.fieldId!)}
              style={{
                color: '#1976d2',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '0.8125rem',
              }}
            >
              + Beet
            </button>,
            <button
              key="delete-field"
              onClick={handleDeleteField(row.fieldId!)}
              style={{
                color: '#d32f2f',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '0.8125rem',
                marginLeft: '8px',
              }}
            >
              Löschen
            </button>,
          ];
        } else if (row.type === 'location') {
          return [
            <button
              key="add-field"
              onClick={() => handleAddField(row.locationId)}
              style={{
                color: '#1976d2',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '0.8125rem',
              }}
            >
              + Schlag
            </button>,
          ];
        }
        return [];
      },
    },
  ];

  /**
   * Custom footer
   */
  const CustomFooter = (): React.ReactElement => {
    const hasMultipleLocations = locations.length > 1;
    
    return (
      <Box sx={{ 
        p: 1, 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}>
        {!hasMultipleLocations && locations.length > 0 && (
          <IconButton
            onClick={() => handleAddField(locations[0]?.id)}
            color="primary"
            size="small"
            aria-label="Neuen Schlag hinzufügen"
          >
            <span style={{ fontSize: '0.875rem', marginRight: '4px' }}>+ Schlag</span>
          </IconButton>
        )}
        <span style={{ color: '#666', fontSize: '0.875rem' }}>
          {hasMultipleLocations 
            ? 'Erweitern Sie Standorte/Schläge um neue Schläge/Beete hinzuzufügen'
            : 'Erweitern Sie Schläge um Beete hinzuzufügen'}
        </span>
      </Box>
    );
  };

  const visibleRows = getVisibleRows();

  return (
    <div className="page-container">
      <h1>Schläge & Beete</h1>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={visibleRows}
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
            footer: CustomFooter,
          }}
          isRowSelectable={(params) => params.row.type === 'bed'}
          isCellEditable={(params) => params.row.type === 'bed'}
          sx={{
            '& .MuiDataGrid-cell--editable': {
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? '#383838' : '#f5f5f5',
            },
          }}
        />
      </Box>
    </div>
  );
}

export default FieldsBedsHierarchy;
