import { useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import type { GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';
import { useTranslation } from '../../i18n';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';

interface TableActionsMenuProps {
  columns: GridColDef[];
  columnVisibilityModel: GridColumnVisibilityModel;
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void;
  autofitEnabled?: boolean;
  onAutofitChange?: (enabled: boolean) => void;
  onCopyTable: () => void;
  onExport: () => void;
  copyDisabled?: boolean;
}

export function TableActionsMenu({
  columns,
  columnVisibilityModel,
  onColumnVisibilityModelChange,
  autofitEnabled,
  onAutofitChange,
  onCopyTable,
  onExport,
  copyDisabled = false,
}: TableActionsMenuProps) {
  const { t } = useTranslation('common');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<HTMLElement | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const closeMenu = (): void => setMenuAnchor(null);

  return (
    <>
      <Tooltip title={t('tableActions.tooltip')}>
        <Button
          size="small"
          color="secondary"
          variant="outlined"
          startIcon={<SettingsOutlinedIcon />}
          aria-label={t('tableActions.tooltip')}
          aria-haspopup="menu"
          aria-expanded={Boolean(menuAnchor)}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
        >
          {t('tableActions.button')}
        </Button>
      </Tooltip>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setColumnMenuAnchor(menuAnchor);
            closeMenu();
            setColumnMenuOpen(true);
          }}
        >
          <ListItemIcon><ViewColumnIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={t('columnVisibility.button')} />
        </MenuItem>
        <MenuItem
          disabled={copyDisabled}
          onClick={() => {
            closeMenu();
            onCopyTable();
          }}
        >
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={t('actions.copyTable')} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onExport();
          }}
        >
          <ListItemIcon><FileDownloadOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={t('actions.export')} />
        </MenuItem>
      </Menu>
      <ColumnVisibilityMenu
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={onColumnVisibilityModelChange}
        autofitEnabled={autofitEnabled}
        onAutofitChange={onAutofitChange}
        anchorEl={columnMenuAnchor}
        open={columnMenuOpen}
        onClose={() => setColumnMenuOpen(false)}
        hideTrigger
      />
    </>
  );
}
