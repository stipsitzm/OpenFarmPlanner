import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import type { GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';
import { useTranslation } from '../../i18n';

interface ColumnVisibilityMenuProps {
  columns: GridColDef[];
  columnVisibilityModel: GridColumnVisibilityModel;
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void;
}

export function ColumnVisibilityMenu({
  columns,
  columnVisibilityModel,
  onColumnVisibilityModelChange,
}: ColumnVisibilityMenuProps) {
  const { t } = useTranslation('common');
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const menuColumns = columns.filter((col) => col.hideable !== false);

  const isVisible = (field: string): boolean =>
    columnVisibilityModel[field] !== false;

  const toggleColumn = (field: string) => {
    onColumnVisibilityModelChange({
      ...columnVisibilityModel,
      [field]: !isVisible(field),
    });
  };

  const visibleCount = menuColumns.filter((col) => isVisible(col.field)).length;
  const allVisible = visibleCount === menuColumns.length;
  const noneVisible = visibleCount === 0;

  const toggleAll = () => {
    const next: GridColumnVisibilityModel = {};
    for (const col of menuColumns) {
      next[col.field] = !allVisible;
    }
    onColumnVisibilityModelChange({ ...columnVisibilityModel, ...next });
  };

  return (
    <Box sx={{ display: 'inline-flex', flexShrink: 0 }}>
      <Tooltip title={t('columnVisibility.buttonTooltip')}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ViewColumnIcon fontSize="small" />}
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={t('columnVisibility.buttonTooltip')}
          aria-haspopup="true"
          aria-expanded={Boolean(anchor)}
          sx={{ textTransform: 'none', flexShrink: 0, minWidth: 0, px: 1.25 }}
        >
          {t('columnVisibility.button')}
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 220, maxHeight: 480 } } }}
      >
        <MenuItem dense onClick={toggleAll}>
          <ListItemIcon>
            <Checkbox
              edge="start"
              size="small"
              checked={allVisible}
              indeterminate={!allVisible && !noneVisible}
              disableRipple
              sx={{ p: 0 }}
            />
          </ListItemIcon>
          <ListItemText
            primary={
              allVisible
                ? t('columnVisibility.hideAll')
                : t('columnVisibility.showAll')
            }
            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
          />
        </MenuItem>
        <Divider />
        {menuColumns.map((col) => {
          const visible = isVisible(col.field);
          return (
            <MenuItem key={col.field} dense onClick={() => toggleColumn(col.field)}>
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  size="small"
                  checked={visible}
                  disableRipple
                  sx={{ p: 0 }}
                />
              </ListItemIcon>
              <ListItemText
                primary={col.headerName ?? col.field}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
