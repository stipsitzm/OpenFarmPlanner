import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import type { GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';
import { useTranslation } from '../../i18n';

interface ColumnVisibilityMenuProps {
  columns: GridColDef[];
  /** Effective visibility model (auto-fit or manual — already resolved). */
  columnVisibilityModel: GridColumnVisibilityModel;
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void;
  /** Whether Autofit is currently enabled. */
  autofitEnabled?: boolean;
  /** Called when the user toggles the Autofit checkbox. */
  onAutofitChange?: (enabled: boolean) => void;
  /** Optional external anchor used when another component owns the trigger. */
  anchorEl?: HTMLElement | null;
  /** Optional controlled open state used with `anchorEl`. */
  open?: boolean;
  /** Called when a controlled menu should close. */
  onClose?: () => void;
  /** Hide the standalone button when the menu is opened from another control. */
  hideTrigger?: boolean;
}

export function ColumnVisibilityMenu({
  columns,
  columnVisibilityModel,
  onColumnVisibilityModelChange,
  autofitEnabled = false,
  onAutofitChange,
  anchorEl,
  open,
  onClose,
  hideTrigger = false,
}: ColumnVisibilityMenuProps) {
  const { t } = useTranslation('common');
  const [internalAnchor, setInternalAnchor] = useState<null | HTMLElement>(null);
  const resolvedAnchor = anchorEl ?? internalAnchor;
  const isOpen = open ?? Boolean(internalAnchor);
  const handleClose = (): void => {
    setInternalAnchor(null);
    onClose?.();
  };

  const menuColumns = columns.filter((col) => col.hideable !== false);

  const isVisible = (field: string): boolean => columnVisibilityModel[field] !== false;

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
    <>
      {!hideTrigger ? (
        <Box sx={{ display: 'inline-flex', flexShrink: 0 }}>
          <Tooltip title={t('columnVisibility.buttonTooltip')}>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<ViewColumnIcon fontSize="small" />}
              onClick={(e) => setInternalAnchor(e.currentTarget)}
              aria-label={t('columnVisibility.buttonTooltip')}
              aria-haspopup="true"
              aria-expanded={isOpen}
              sx={{ textTransform: 'none', flexShrink: 0, whiteSpace: 'nowrap', px: 1.25, bgcolor: 'background.paper' }}
            >
              {t('columnVisibility.button')}
            </Button>
          </Tooltip>
        </Box>
      ) : null}

      <Menu
        anchorEl={resolvedAnchor}
        open={isOpen}
        onClose={handleClose}
        slotProps={{ paper: { sx: { minWidth: 270, maxHeight: 560 } } }}
      >
        {onAutofitChange ? (
          <Box sx={{ px: 2, py: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={autofitEnabled}
                  onChange={(e) => onAutofitChange(e.target.checked)}
                  sx={{ py: 0.5 }}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t('columnVisibility.autofitLabel')}
                </Typography>
              }
            />
          </Box>
        ) : null}

        {onAutofitChange ? <Divider /> : null}

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
            primary={allVisible ? t('columnVisibility.hideAll') : t('columnVisibility.showAll')}
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
    </>
  );
}
