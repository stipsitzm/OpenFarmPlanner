/**
 * Column definitions for hierarchy grid
 */

import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import type { TFunction } from 'i18next';
import { Box, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import type { HierarchyRow } from '../utils/types';

/**
 * Render name cell with expansion controls
 */
function renderNameCell(
  params: GridRenderCellParams<HierarchyRow>,
  onToggleExpand: (rowId: string | number) => void
) {
  const row = params.row;
  const indent = row.level * 24;

  if (row.type === 'location' || row.type === 'field') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', pl: `${indent}px` }}>
        <IconButton
          size="small"
          onClick={() => onToggleExpand(row.id)}
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
}

/**
 * Create column definitions for hierarchy grid
 */
export function createHierarchyColumns(
  onToggleExpand: (rowId: string | number) => void,
  onAddBed: (fieldId: number) => void,
  onDeleteBed: (bedId: number) => void,
  onAddField: (locationId?: number) => void,
  onDeleteField: (fieldId: number) => void,
  t: TFunction
): GridColDef<HierarchyRow>[] {
  return [
    {
      field: 'name',
      headerName: t('hierarchy:columns.name'),
      width: 300,
      editable: true,
      renderCell: (params) => renderNameCell(params, onToggleExpand),
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'area_sqm',
      headerName: t('hierarchy:columns.area'),
      width: 120,
      type: 'number',
      editable: true,
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      width: 300,
      editable: true,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('common:actions.actions'),
      width: 150,
      getActions: ({ row }) => {
        if (row.type === 'bed') {
          return [
            <button
              key="delete"
              onClick={() => onDeleteBed(row.bedId!)}
              style={{
                color: '#d32f2f',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '0.8125rem',
              }}
            >
              {t('common:actions.delete')}
            </button>,
          ];
        } else if (row.type === 'field') {
          return [
            <button
              key="add-bed"
              onClick={() => onAddBed(row.fieldId!)}
              style={{
                color: '#1976d2',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '0.8125rem',
              }}
            >
              {t('hierarchy:addBed')}
            </button>,
            <button
              key="delete-field"
              onClick={() => onDeleteField(row.fieldId!)}
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
              {t('common:actions.delete')}
            </button>,
          ];
        } else if (row.type === 'location') {
          return [
            <button
              key="add-field"
              onClick={() => onAddField(row.locationId)}
              style={{
                color: '#1976d2',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
                fontSize: '0.8125rem',
              }}
            >
              {t('hierarchy:addField')}
            </button>,
          ];
        }
        return [];
      },
    },
  ];
}
