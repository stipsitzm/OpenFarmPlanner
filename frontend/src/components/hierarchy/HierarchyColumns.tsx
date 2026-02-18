/**
 * Column definitions for hierarchy grid
 */

import type { ReactElement, MouseEvent } from 'react';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import type { TFunction } from 'i18next';
import { Box, IconButton, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import type { HierarchyRow } from './utils/types';
import { NotesCell } from '../data-grid/NotesCell';
import { getPlainExcerpt } from '../data-grid/markdown';


const HIERARCHY_COLUMN_WIDTHS = {
  name: 280,
  area: 120,
  notes: 320,
} as const;

interface NameCellCallbacks {
  onToggleExpand: (rowId: string | number) => void;
  onAddBed: (fieldId: number) => void;
  onDeleteBed: (bedId: number) => void;
  onAddField: (locationId?: number) => void;
  onDeleteField: (fieldId: number) => void;
  onCreatePlantingPlan: (bedId: number) => void;
}

function ActionIconButton({
  label,
  color,
  onClick,
  icon,
}: {
  label: string;
  color?: 'default' | 'primary' | 'error';
  onClick: (event: MouseEvent) => void;
  icon: ReactElement;
}): ReactElement {
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        color={color}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onClick(event);
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

/**
 * Render row-specific action icons directly inside the hierarchy name cell.
 */
function renderInlineActions(
  row: HierarchyRow,
  callbacks: NameCellCallbacks,
  t: TFunction
): ReactElement | null {
  if (row.type === 'location') {
    return (
      <ActionIconButton
        label={t('hierarchy:addField')}
        color="primary"
        onClick={() => callbacks.onAddField(row.locationId)}
        icon={<AddIcon fontSize="small" />}
      />
    );
  }

  if (row.type === 'field') {
    return (
      <>
        <ActionIconButton
          label={t('hierarchy:addBed')}
          color="primary"
          onClick={() => callbacks.onAddBed(row.fieldId!)}
          icon={<AddIcon fontSize="small" />}
        />
        <ActionIconButton
          label={t('common:actions.delete')}
          color="error"
          onClick={() => callbacks.onDeleteField(row.fieldId!)}
          icon={<DeleteIcon fontSize="small" />}
        />
      </>
    );
  }

  if (row.type === 'bed') {
    return (
      <>
        <ActionIconButton
          label={t('hierarchy:createPlantingPlan')}
          color="primary"
          onClick={() => callbacks.onCreatePlantingPlan(row.bedId!)}
          icon={<AgricultureIcon fontSize="small" />}
        />
        <ActionIconButton
          label={t('common:actions.delete')}
          color="error"
          onClick={() => callbacks.onDeleteBed(row.bedId!)}
          icon={<DeleteIcon fontSize="small" />}
        />
      </>
    );
  }

  return null;
}

/**
 * Render name cell with expansion controls and inline hierarchy actions.
 */
function renderNameCell(
  params: GridRenderCellParams<HierarchyRow>,
  callbacks: NameCellCallbacks,
  t: TFunction
) {
  const row = params.row;
  // Beds should be indented more than fields
  const baseIndent = row.level * 24;
  const indent = row.type === 'bed' ? baseIndent + 34 : baseIndent;

  const hasExpandToggle = row.type === 'location' || row.type === 'field';
  const showInlineActions = params.cellMode !== 'edit';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: `${indent}px`, width: '100%', gap: 0.5 }}>
      {hasExpandToggle && (
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            callbacks.onToggleExpand(row.id);
          }}
          sx={{ mr: 1 }}
        >
          {row.expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
        </IconButton>
      )}

      {!hasExpandToggle && <Box sx={{ width: 32 }} />}

      <Box sx={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, gap: 0.5 }}>
        <Box
          component="span"
          sx={{
            fontWeight: row.type === 'location' ? 'bold' : 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {params.value}
        </Box>

        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {showInlineActions ? renderInlineActions(row, callbacks, t) : null}
        </Box>
      </Box>
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
  const callbacks: NameCellCallbacks = {
    onToggleExpand,
    onAddBed,
    onDeleteBed,
    onAddField,
    onDeleteField,
    onCreatePlantingPlan,
  };

  return [
    {
      field: 'name',
      headerName: t('hierarchy:columns.name'),
      width: HIERARCHY_COLUMN_WIDTHS.name,
      editable: true,
      renderCell: (params) => renderNameCell(params, callbacks, t),
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'area_sqm',
      headerName: t('hierarchy:columns.area'),
      width: HIERARCHY_COLUMN_WIDTHS.area,
      type: 'number',
      editable: true,
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      width: HIERARCHY_COLUMN_WIDTHS.notes,
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
  ];
}
