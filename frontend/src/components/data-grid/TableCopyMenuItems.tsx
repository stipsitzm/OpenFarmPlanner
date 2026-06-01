import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TableRowsIcon from '@mui/icons-material/TableRows';
import { Divider, ListItemIcon, ListItemText, MenuItem } from '@mui/material';
import type React from 'react';
import { buildTsv, copyTextToClipboard, showClipboardSnackbar, type TableClipboardRow } from './tableClipboard';

interface TableCopyMenuItemsProps {
  rowValues: TableClipboardRow | null;
  tableRows: readonly TableClipboardRow[];
  copyRowLabel: string;
  copyTableLabel: string;
  rowCopiedMessage: string;
  tableCopiedMessage: string;
  copyErrorMessage: string;
  includeDivider?: boolean;
  onClose?: () => void;
}

export function TableCopyMenuItems({
  rowValues,
  tableRows,
  copyRowLabel,
  copyTableLabel,
  rowCopiedMessage,
  tableCopiedMessage,
  copyErrorMessage,
  includeDivider = true,
  onClose,
}: TableCopyMenuItemsProps): React.ReactElement {
  const copy = async (rows: readonly TableClipboardRow[], successMessage: string): Promise<void> => {
    try {
      await copyTextToClipboard(buildTsv(rows));
      showClipboardSnackbar({ message: successMessage, severity: 'success' });
    } catch (error) {
      console.error('Error copying table data', error);
      showClipboardSnackbar({ message: copyErrorMessage, severity: 'error' });
    }
  };

  const handleCopyRow = (): void => {
    if (!rowValues) {
      return;
    }
    onClose?.();
    void copy([rowValues], rowCopiedMessage);
  };

  const handleCopyTable = (): void => {
    onClose?.();
    void copy(tableRows, tableCopiedMessage);
  };

  return (
    <>
      {includeDivider ? <Divider role="separator" /> : null}
      <MenuItem onClick={handleCopyRow} disabled={!rowValues}>
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={copyRowLabel} />
      </MenuItem>
      <MenuItem onClick={handleCopyTable} disabled={tableRows.length === 0}>
        <ListItemIcon>
          <TableRowsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={copyTableLabel} />
      </MenuItem>
    </>
  );
}
