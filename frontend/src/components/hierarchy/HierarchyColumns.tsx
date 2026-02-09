/**
 * Column definitions for hierarchy grid
 */

import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import type { TFunction } from 'i18next';
import { Box, IconButton, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import type { HierarchyRow } from './utils/types';
import { NotesCell } from '../data-grid/NotesCell';
import { getPlainExcerpt } from '../data-grid/markdown';

/**
 * Render name cell with expansion controls
 */
function renderNameCell(
  params: GridRenderCellParams<HierarchyRow>,
  onToggleExpand: (rowId: string | number) => void
) {
  const row = params.row;
  // Beds (type 'bed') sollen weiter eingerückt werden als Felder
  const baseIndent = row.level * 24;
  const indent = row.type === 'bed' ? baseIndent + 34 : baseIndent;

  if (row.type === 'location' || row.type === 'field') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', pl: `${indent}px` }}>
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand(row.id);
          }}
          sx={{ mr: 1 }}
        >
          {row.expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
        </IconButton>
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
  onCreatePlantingPlan: (bedId: number) => void,
  onOpenNotes: (rowId: string | number, field: string) => void,
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
      width: 250,
      editable: false,
      renderCell: (params) => {
        const value = (params.value as string) || '';
        const hasValue = value.trim().length > 0;
        const excerpt = hasValue ? getPlainExcerpt(value, 120) : '';
        
        return (
          <NotesCell
            hasValue={hasValue}
            excerpt={excerpt}
            rawValue={value}
            onOpen={() => onOpenNotes(params.id, 'notes')}
          />
        );
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('common:actions.actions'),
      flex: 1,
      minWidth: 280,
      getActions: ({ row }) => {
        if (row.type === 'bed') {
          return [
            <Button
              key="create-plan"
              variant="outlined"
              size="small"
              startIcon={<AgricultureIcon />}
              onClick={() => onCreatePlantingPlan(row.bedId!)}
            >
              {t('hierarchy:createPlantingPlan')}
            </Button>,
            <Button
              key="delete"
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => onDeleteBed(row.bedId!)}
            >
              {t('common:actions.delete')}
            </Button>,
          ];
        } else if (row.type === 'field') {
          return [
            <Button
              key="add-bed"
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddBed(row.fieldId!)}
            >
              {t('hierarchy:addBed')}
            </Button>,
            <Button
              key="delete-field"
              variant="outlined"
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => onDeleteField(row.fieldId!)}
            >
              {t('common:actions.delete')}
            </Button>,
          ];
        } else if (row.type === 'location') {
          return [
            <Button
              key="add-field"
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddField(row.locationId)}
            >
              {t('hierarchy:addField')}
            </Button>,
          ];
        }
        return [];
      },
    },
  ];
}
