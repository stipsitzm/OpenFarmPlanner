/**
 * NotesCell component for rendering notes field in DataGrid.
 * 
 * Displays an icon button that indicates whether notes exist.
 * Shows a tooltip with excerpt on hover.
 * Clicking opens the notes editor drawer.
 */

import { IconButton, Tooltip } from '@mui/material';
import NotesIcon from '@mui/icons-material/Notes';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';

export interface NotesCellProps {
  /** Whether the cell has a value (non-empty notes) */
  hasValue: boolean;
  /** Plain text excerpt to show in tooltip */
  excerpt: string;
  /** Handler called when the icon is clicked */
  onOpen: () => void;
}

/**
 * Renders a notes cell with icon and tooltip.
 * Shows filled icon if notes exist, outlined icon if empty.
 */
export function NotesCell({ hasValue, excerpt, onOpen }: NotesCellProps): React.ReactElement {
  const tooltipTitle = excerpt || 'Keine Notizen';
  
  return (
    <Tooltip title={tooltipTitle} placement="top">
      <IconButton
        onClick={onOpen}
        size="small"
        sx={{ 
          color: hasValue ? 'primary.main' : 'action.disabled',
          padding: '4px',
        }}
        aria-label="Notizen bearbeiten"
      >
        {hasValue ? <NotesIcon fontSize="small" /> : <NotesOutlinedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
