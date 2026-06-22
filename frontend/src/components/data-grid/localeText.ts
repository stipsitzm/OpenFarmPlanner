import type { GridLocaleText } from '@mui/x-data-grid';
import { deDE } from '@mui/x-data-grid/locales';

const muideDEText = deDE.components.MuiDataGrid.defaultProps.localeText as GridLocaleText;

export const germanDataGridLocaleText: Partial<GridLocaleText> = {
  ...muideDEText,
  noRowsLabel: 'Keine Einträge vorhanden',
  noResultsOverlayLabel: 'Keine passenden Einträge gefunden',
};
