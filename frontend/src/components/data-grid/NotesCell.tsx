/**
 * NotesCell component for rendering notes field in DataGrid.
 * 
 * Displays an icon button with a text preview of the first line.
 * Shows a tooltip with excerpt on hover.
 * Clicking opens the notes editor drawer.
 */

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
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
 * Renders a notes cell with icon, text preview, and tooltip.
 * Shows filled icon if notes exist, outlined icon if empty.
 * Displays first line with "..." if more content exists.
 */
export function NotesCell({ hasValue, excerpt, onOpen }: NotesCellProps): React.ReactElement {
  const tooltipTitle = excerpt || 'Keine Notizen';
  
  // Extract first line for display (up to 40 chars)
  const firstLine = excerpt.split('\n')[0];
  const displayText = firstLine.length > 40 
    ? `${firstLine.substring(0, 37)}...` 
    : firstLine;
  const hasMore = excerpt.length > firstLine.length || firstLine.length > 40;
  
  return (
    <Tooltip title={tooltipTitle} placement="top">
      <Box
        onClick={onOpen}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          width: '100%',
          height: '100%',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <IconButton
          size="small"
          sx={{ 
            color: hasValue ? 'primary.main' : 'action.disabled',
            padding: '4px',
          }}
          aria-label="Notizen bearbeiten"
        >
          {hasValue ? <NotesIcon fontSize="small" /> : <NotesOutlinedIcon fontSize="small" />}
        </IconButton>
        {hasValue && displayText && (
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            {displayText}
            {hasMore && <span style={{ opacity: 0.7 }}> ...</span>}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}
