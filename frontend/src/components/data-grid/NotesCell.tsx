/**
 * NotesCell component for rendering notes field in DataGrid.
 * 
 * Displays an icon button with a text preview of the first line.
 * Shows a tooltip with formatted markdown preview on hover.
 * Clicking opens the notes editor drawer.
 */

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import NotesIcon from '@mui/icons-material/Notes';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../../i18n';

export interface NotesCellProps {
  /** Whether the cell has a value (non-empty notes) */
  hasValue: boolean;
  /** Plain text excerpt to show in grid cell */
  excerpt: string;
  /** Full raw markdown value for tooltip preview */
  rawValue: string;
  /** Handler called when the icon is clicked */
  onOpen: () => void;
}

/**
 * Renders a notes cell with icon, text preview, and markdown tooltip.
 * Shows filled icon if notes exist, outlined icon if empty.
 * Displays first line with "..." if more content exists.
 * Tooltip shows formatted markdown preview (limited to 2000 chars for performance).
 */
export function NotesCell({ hasValue, excerpt, rawValue, onOpen }: NotesCellProps): React.ReactElement {
  const { t } = useTranslation('common');
  
  // Extract first line for display (up to 40 chars)
  const firstLine = excerpt.split('\n')[0];
  const displayText = firstLine.length > 40 
    ? `${firstLine.substring(0, 37)}...` 
    : firstLine;
  const hasMore = excerpt.length > firstLine.length || firstLine.length > 40;
  
  // Prepare tooltip content
  // Limit to 2000 chars to avoid huge DOM in tooltip (optional safety measure)
  const tooltipMarkdown = rawValue.length > 2000 
    ? rawValue.substring(0, 2000) + '\n\n...' 
    : rawValue;
  
  const tooltipContent = hasValue ? (
    <Box
      sx={{
        maxWidth: 480,
        maxHeight: 280,
        overflowY: 'auto',
        p: 1.5,
        // Disable pointer events to prevent link clicks in tooltip
        pointerEvents: 'none',
        // Ensure good typography
        '& p': { margin: '0.5em 0' },
        '& p:first-of-type': { marginTop: 0 },
        '& p:last-of-type': { marginBottom: 0 },
        '& ul, & ol': { margin: '0.5em 0', paddingLeft: '1.5em' },
        '& li': { margin: '0.25em 0' },
        '& code': { 
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          padding: '0.1em 0.3em',
          borderRadius: '3px',
          fontSize: '0.9em',
        },
        '& pre': {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          padding: '0.5em',
          borderRadius: '4px',
          overflowX: 'auto',
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Disable HTML rendering for security
          html: () => null,
          // Render links as plain text (no href)
          a: ({ children }) => <span>{children}</span>,
        }}
      >
        {tooltipMarkdown}
      </ReactMarkdown>
    </Box>
  ) : (
    <Typography variant="body2">{t('notes.empty')}</Typography>
  );
  
  return (
    <Tooltip 
      title={tooltipContent}
      placement="top"
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 480,
            backgroundColor: 'background.paper',
            color: 'text.primary',
            boxShadow: 2,
            border: 1,
            borderColor: 'divider',
          },
        },
      }}
    >
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
