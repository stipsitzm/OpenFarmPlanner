/**
 * Common event handlers for MUI DataGrid components.
 * 
 * Provides reusable handlers for consistent behavior across all DataGrid instances.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GridRowModes, GridRowEditStopReasons } from '@mui/x-data-grid';
import type { GridEventListener, GridRowModesModel, GridCellParams } from '@mui/x-data-grid';

/**
 * Handler for cell click events that enables edit mode on editable cells.
 * 
 * This handler automatically switches a row to edit mode when a user clicks
 * on an editable cell, focusing the clicked field. This provides Excel-like
 * inline editing behavior.
 * 
 * @param params - The cell click event parameters
 * @param rowModesModel - Current row modes model state
 * @param setRowModesModel - Function to update row modes model state
 */
export function handleEditableCellClick(
  params: GridCellParams,
  rowModesModel: GridRowModesModel,
  setRowModesModel: Dispatch<SetStateAction<GridRowModesModel>>
): void {
  if (params.isEditable && rowModesModel[params.id]?.mode !== GridRowModes.Edit) {
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [params.id]: { mode: GridRowModes.Edit, fieldToFocus: params.field },
    }));
  }
}

/**
 * Handler for row edit stop events that prevents exiting edit mode on focus out.
 * 
 * This handler prevents the DataGrid from automatically exiting edit mode when
 * the row loses focus. This allows users to click outside the grid without
 * automatically committing changes, providing better control over the edit flow.
 * 
 * @param params - The row edit stop event parameters
 * @param event - The underlying DOM event
 */
export const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event): void => {
  if (params.reason === GridRowEditStopReasons.rowFocusOut) {
    event.defaultMuiPrevented = true;
  }
};
