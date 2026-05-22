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
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import type { HierarchyRow } from './utils/types';
import { NotesCell } from '../data-grid/NotesCell';
import { AddBedIcon } from './AddBedIcon';
import { getPlainExcerpt } from '../data-grid/markdown';
import { getCalculatedColumnProps } from '../data-grid/calculatedColumns';

export interface HierarchyColumnWidths {
  name: number;
  area: number;
  dimensions: number;
  notes: number;
}

export const DEFAULT_HIERARCHY_COLUMN_WIDTHS: HierarchyColumnWidths = {
  name: 280,
  area: 120,
  dimensions: 130,
  notes: 220,
};

const EXPAND_ICON_SLOT_SIZE = 32;
const DATA_GRID_HEADER_LABEL_SX = { fontWeight: 600 };

interface NameCellCallbacks {
  onToggleExpand: (rowId: string | number) => void;
  onAddBed: (fieldId: number) => void;
  onDeleteBed: (bedId: number) => void;
  onAddField: (locationId?: number) => void;
  onDeleteField: (fieldId: number) => void;
  onDeleteLocation: (locationId: number) => void;
  onCreatePlantingPlan: (bedId: number) => void;
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, row: HierarchyRow) => void;
}

function renderActionIconButton({
  label,
  color,
  onClick,
  icon,
  sx,
}: {
  label: string;
  color?: 'default' | 'primary' | 'error';
  onClick: (event: MouseEvent) => void;
  icon: ReactElement;
  sx?: Record<string, unknown>;
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
        sx={{
          p: 0.5,
          '& .MuiSvgIcon-root': { fontSize: 18 },
          ...sx,
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function renderInlineActions(
  row: HierarchyRow,
  callbacks: NameCellCallbacks,
  t: TFunction
): ReactElement | null {
  if (row.type === 'location') {
    return (
      <Box className="action-icons" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {renderActionIconButton({
          label: t('hierarchy:addField'),
          color: 'primary',
          onClick: () => callbacks.onAddField(row.locationId),
          icon: <AddIcon />,
        })}
        {renderActionIconButton({
          label: t('common:actions.delete'),
          color: 'error',
          onClick: () => callbacks.onDeleteLocation(row.locationId!),
          icon: <DeleteIcon />,
        })}
      </Box>
    );
  }

  if (row.type === 'field') {
    return (
      <Box className="action-icons" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={t('hierarchy:addBedToField')}>
          <span>
            <AddBedIcon
              ariaLabel={t('hierarchy:addBedToField')}
              onClick={(event) => {
                event.stopPropagation();
                callbacks.onAddBed(row.fieldId!);
              }}
              sx={{ p: 0.5, '& .MuiSvgIcon-root': { fontSize: 18 } }}
            />
          </span>
        </Tooltip>
        {renderActionIconButton({
          label: t('common:actions.delete'),
          color: 'error',
          onClick: () => callbacks.onDeleteField(row.fieldId!),
          icon: <DeleteIcon />,
          sx: {
            opacity: 0.7,
            '&:hover': { opacity: 1 },
          },
        })}
      </Box>
    );
  }

  if (row.type === 'bed') {
    return (
      <Box className="action-icons" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {renderActionIconButton({
          label: t('hierarchy:createPlantingPlan'),
          color: 'primary',
          onClick: () => callbacks.onCreatePlantingPlan(row.bedId!),
          icon: <AgricultureIcon />,
        })}
        {renderActionIconButton({
          label: t('common:actions.delete'),
          color: 'error',
          onClick: () => callbacks.onDeleteBed(row.bedId!),
          icon: <DeleteIcon />,
          sx: {
            opacity: 0.7,
            '&:hover': { opacity: 1 },
          },
        })}
      </Box>
    );
  }

  return null;
}

function renderNameCell(
  params: GridRenderCellParams<HierarchyRow>,
  callbacks: NameCellCallbacks,
  t: TFunction
) {
  const row = params.row;
  const baseIndent = row.level * 24;
  const hasChildren = row.hasChildren === true;
  const hasExpandToggle = (row.type === 'location' || row.type === 'field') && hasChildren;
  const showInlineActions = params.cellMode !== 'edit';
  const isStandaloneRender = params.api === undefined;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: `${baseIndent}px`, width: '100%', gap: 0.5 }}>
      <Box
        sx={{
          width: EXPAND_ICON_SLOT_SIZE,
          minWidth: EXPAND_ICON_SLOT_SIZE,
          height: EXPAND_ICON_SLOT_SIZE,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 1,
          pointerEvents: hasExpandToggle ? 'auto' : 'none',
        }}
        data-testid="expand-icon-slot"
      >
        {hasExpandToggle ? (
          <Tooltip title={row.expanded ? t('tooltips.collapse') : t('tooltips.expand')}>
            <IconButton
              size="small"
              aria-label={row.expanded ? t('tooltips.collapse') : t('tooltips.expand')}
              onClick={(event) => {
                event.stopPropagation();
                callbacks.onToggleExpand(row.id);
              }}
            >
              {row.expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
            </IconButton>
          </Tooltip>
        ) : (
          <Box
            aria-hidden="true"
            sx={{ width: EXPAND_ICON_SLOT_SIZE, height: EXPAND_ICON_SLOT_SIZE, visibility: 'hidden' }}
          >
            <ChevronRightIcon />
          </Box>
        )}
      </Box>

      <Box
        sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', minWidth: 0, width: '100%' }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          callbacks.onOpenContextMenu(event, row);
        }}
      >
        <Box
          component="span"
          sx={{
            fontWeight: row.type === 'location' ? 600 : 400,
            fontSize: row.type === 'location' ? '1.02rem' : row.type === 'bed' ? '0.95rem' : '1rem',
            color: 'text.primary',
            bgcolor: 'transparent',
            borderRadius: 0.5,
            px: row.type === 'bed' ? 0.5 : 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            pr: 7,
          }}
        >
          {params.value}
        </Box>

        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            opacity: isStandaloneRender ? 1 : 0,
            pointerEvents: isStandaloneRender ? 'auto' : 'none',
            transition: 'opacity 120ms ease-in-out',
            '.MuiDataGrid-row:hover &': {
              opacity: 1,
              pointerEvents: 'auto',
            },
            '.MuiDataGrid-row.Mui-selected &': {
              opacity: 1,
              pointerEvents: 'auto',
            },
          }}
        >
          {showInlineActions ? renderInlineActions(row, callbacks, t) : null}
        </Box>
      </Box>
    </Box>
  );
}

const calculateAreaValue = (row: HierarchyRow): number | string | undefined => {
  if (row.type === 'location') {
    return undefined;
  }

  const length = typeof row.length_m === 'number' ? row.length_m : null;
  const width = typeof row.width_m === 'number' ? row.width_m : null;
  if (length !== null && width !== null) {
    return Math.round(length * width * 10) / 10;
  }

  return row.area_sqm;
};

type DimensionCellType = 'length' | 'width' | 'area';

interface DimensionRowState {
  hasLength: boolean;
  hasWidth: boolean;
  hasAreaValue: boolean;
}

const parseNumericValue = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number.parseFloat(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const getDimensionRowState = (row: HierarchyRow): DimensionRowState | null => {
  if (row.type !== 'field' && row.type !== 'bed') {
    return null;
  }
  const lengthValue = parseNumericValue(row.length_m);
  const widthValue = parseNumericValue(row.width_m);
  const areaValue = parseNumericValue(row.area_sqm);
  return {
    hasLength: Number.isFinite(lengthValue ?? NaN),
    hasWidth: Number.isFinite(widthValue ?? NaN),
    hasAreaValue: Number.isFinite(areaValue ?? NaN),
  };
};

const isDimensionCellIncomplete = (type: DimensionCellType, rowState: DimensionRowState): boolean => {
  if (type === 'length') {
    return !rowState.hasLength;
  }
  if (type === 'width') {
    return !rowState.hasWidth;
  }
  return !(rowState.hasAreaValue || (rowState.hasLength && rowState.hasWidth));
};

const getDimensionCellClassName = (row: HierarchyRow, type: DimensionCellType): string => {
  const rowState = getDimensionRowState(row);
  if (!rowState || !isDimensionCellIncomplete(type, rowState)) {
    return '';
  }
  return 'ofp-hierarchy-cell-missing-dimension';
};

const renderDimensionCell = (
  params: GridRenderCellParams<HierarchyRow>,
  type: DimensionCellType,
  t: TFunction,
): ReactElement => {
  const rowState = getDimensionRowState(params.row);
  const displayValue = params.formattedValue ?? params.value;
  const hasDisplayValue = displayValue !== null && displayValue !== undefined && String(displayValue).trim() !== '';

  if (!rowState || !isDimensionCellIncomplete(type, rowState)) {
    return <Box component="span">{hasDisplayValue ? String(displayValue) : ''}</Box>;
  }

  return (
    <Tooltip title={t('hierarchy:messages.missingDimensionsCellTooltip')} enterDelay={250}>
      <Box
        component="span"
        sx={{
          width: '100%',
          minWidth: 0,
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: 1.2,
        }}
      >
        <Box
          component="span"
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: hasDisplayValue ? 'text.primary' : 'text.secondary',
          }}
        >
          {hasDisplayValue ? String(displayValue) : '—'}
        </Box>
      </Box>
    </Tooltip>
  );
};

const renderCalculatedValueCell = (params: GridRenderCellParams<HierarchyRow>): ReactElement => {
  const displayValue = params.formattedValue ?? params.value;
  const hasDisplayValue = displayValue !== null && displayValue !== undefined && String(displayValue).trim() !== '';

  return <Box component="span">{hasDisplayValue ? String(displayValue) : '—'}</Box>;
};

export function createHierarchyColumns(
  onToggleExpand: (rowId: string | number) => void,
  onAddBed: (fieldId: number) => void,
  onDeleteBed: (bedId: number) => void,
  onAddField: (locationId?: number) => void,
  onDeleteField: (fieldId: number) => void,
  onDeleteLocationOrCreatePlantingPlan: ((locationId: number) => void) | ((bedId: number) => void),
  onCreatePlantingPlanOrOpenNotes: ((bedId: number) => void) | ((rowId: string | number, field: string) => void),
  onOpenContextMenuOrT: ((event: MouseEvent<HTMLElement>, row: HierarchyRow) => void) | TFunction,
  onOpenNotesOrColumnWidths?: ((rowId: string | number, field: string) => void) | Partial<HierarchyColumnWidths>,
  tOrColumnWidths?: TFunction | Partial<HierarchyColumnWidths>,
  columnWidths?: Partial<HierarchyColumnWidths>
): GridColDef<HierarchyRow>[] {
  const usesLegacySignature = typeof onOpenNotesOrColumnWidths !== 'function' && typeof tOrColumnWidths !== 'function';
  const onDeleteLocation = usesLegacySignature
    ? (): void => undefined
    : onDeleteLocationOrCreatePlantingPlan as (locationId: number) => void;
  const onCreatePlantingPlan = usesLegacySignature
    ? onDeleteLocationOrCreatePlantingPlan as (bedId: number) => void
    : onCreatePlantingPlanOrOpenNotes as (bedId: number) => void;
  const onOpenContextMenu = usesLegacySignature
    ? (): void => undefined
    : onOpenContextMenuOrT as (event: MouseEvent<HTMLElement>, row: HierarchyRow) => void;
  const onOpenNotes = usesLegacySignature
    ? onCreatePlantingPlanOrOpenNotes as (rowId: string | number, field: string) => void
    : onOpenNotesOrColumnWidths as (rowId: string | number, field: string) => void;
  const t = (usesLegacySignature ? onOpenContextMenuOrT : tOrColumnWidths) as TFunction;
  const resolvedColumnWidths = (usesLegacySignature ? onOpenNotesOrColumnWidths : columnWidths) as Partial<HierarchyColumnWidths> | undefined;
  const widths: HierarchyColumnWidths = {
    ...DEFAULT_HIERARCHY_COLUMN_WIDTHS,
    ...resolvedColumnWidths,
  };

  const callbacks: NameCellCallbacks = {
    onToggleExpand,
    onAddBed,
    onDeleteBed,
    onAddField,
    onDeleteField,
    onDeleteLocation,
    onCreatePlantingPlan,
    onOpenContextMenu,
  };

  return [
    {
      field: 'name',
      headerName: t('hierarchy:columns.name'),
      width: widths.name,
      editable: true,
      renderCell: (params) => renderNameCell(params, callbacks, t),
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'length_m',
      headerName: t('columns.length'),
      renderHeader: () => (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <SwapVertIcon fontSize="small" aria-hidden="true" />
          <Box component="span" sx={DATA_GRID_HEADER_LABEL_SX}>{t('columns.length')}</Box>
        </Box>
      ),
      width: widths.dimensions,
      type: 'string',
      editable: true,
      valueGetter: (_value, row: HierarchyRow) => row.type === 'location' ? undefined : row.length_m,
      cellClassName: (params) => getDimensionCellClassName(params.row, 'length'),
      renderCell: (params) => renderDimensionCell(params, 'length', t),
    },
    {
      field: 'width_m',
      headerName: t('columns.width'),
      renderHeader: () => (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <SwapHorizIcon fontSize="small" aria-hidden="true" />
          <Box component="span" sx={DATA_GRID_HEADER_LABEL_SX}>{t('columns.width')}</Box>
        </Box>
      ),
      width: widths.dimensions,
      type: 'string',
      editable: true,
      valueGetter: (_value, row: HierarchyRow) => row.type === 'location' ? undefined : row.width_m,
      cellClassName: (params) => getDimensionCellClassName(params.row, 'width'),
      renderCell: (params) => renderDimensionCell(params, 'width', t),
    },
    {
      field: 'area_sqm',
      headerName: t('hierarchy:columns.area'),
      width: widths.area,
      type: 'string',
      ...getCalculatedColumnProps<HierarchyRow>({
        headerName: t('hierarchy:columns.area'),
        tooltip: t('hierarchy:tooltips.calculatedArea'),
      }),
      valueGetter: (_value, row: HierarchyRow) => calculateAreaValue(row),
      renderCell: renderCalculatedValueCell,
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      width: widths.notes,
      minWidth: 180,
      maxWidth: 260,
      editable: false,
      renderCell: (params) => {
        const value = (params.value as string) || '';
        const hasValue = value.trim().length > 0;
        const excerpt = hasValue ? getPlainExcerpt(value, 120) : '';

        return (
          <Box
            sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
            onClick={() => onOpenNotes(params.id, 'notes')}
          >
            <NotesCell
              hasValue={hasValue}
              excerpt={excerpt}
              rawValue={value}
              onOpen={() => onOpenNotes(params.id, 'notes')}
            />
          </Box>
        );
      },
    },
  ];
}
