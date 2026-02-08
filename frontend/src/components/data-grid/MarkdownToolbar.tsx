/**
 * MarkdownToolbar component for markdown formatting buttons.
 * 
 * Provides quick buttons for common markdown formatting:
 * - Bold, Italic, Code
 * - Headings, Lists
 * - Links
 */

import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import TitleIcon from '@mui/icons-material/Title';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

export interface MarkdownToolbarProps {
  /** Handler called when a formatting action is requested */
  onFormat: (format: MarkdownFormat) => void;
}

export type MarkdownFormat =
  | 'bold'
  | 'italic'
  | 'code'
  | 'heading'
  | 'bullet-list'
  | 'numbered-list'
  | 'link'
  | 'quote';

/**
 * Toolbar with markdown formatting buttons.
 */
export function MarkdownToolbar({ onFormat }: MarkdownToolbarProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        flexWrap: 'wrap',
      }}
    >
      <Tooltip title="Fettdruck (Strg+B)">
        <IconButton
          size="small"
          onClick={() => onFormat('bold')}
          aria-label="Fettdruck"
        >
          <FormatBoldIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Kursiv (Strg+I)">
        <IconButton
          size="small"
          onClick={() => onFormat('italic')}
          aria-label="Kursiv"
        >
          <FormatItalicIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Code">
        <IconButton
          size="small"
          onClick={() => onFormat('code')}
          aria-label="Code"
        >
          <CodeIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Überschrift">
        <IconButton
          size="small"
          onClick={() => onFormat('heading')}
          aria-label="Überschrift"
        >
          <TitleIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Aufzählungsliste">
        <IconButton
          size="small"
          onClick={() => onFormat('bullet-list')}
          aria-label="Aufzählungsliste"
        >
          <FormatListBulletedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Nummerierte Liste">
        <IconButton
          size="small"
          onClick={() => onFormat('numbered-list')}
          aria-label="Nummerierte Liste"
        >
          <FormatListNumberedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Link einfügen">
        <IconButton
          size="small"
          onClick={() => onFormat('link')}
          aria-label="Link einfügen"
        >
          <LinkIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Zitat">
        <IconButton
          size="small"
          onClick={() => onFormat('quote')}
          aria-label="Zitat"
        >
          <FormatQuoteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
