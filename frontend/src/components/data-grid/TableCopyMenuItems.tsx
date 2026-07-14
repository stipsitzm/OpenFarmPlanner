import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TableRowsIcon from '@mui/icons-material/TableRows';
import { Divider, ListItemIcon, ListItemText, MenuItem } from '@mui/material';
import { copyRowsToClipboard, type TableClipboardRow } from './tableClipboard';

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
}: TableCopyMenuItemsProps) {
  const copy = async (rows: readonly TableClipboardRow[], successMessage: string): Promise<void> => {
    await copyRowsToClipboard({
      rows,
      successMessage,
      errorMessage: copyErrorMessage,
    });
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
