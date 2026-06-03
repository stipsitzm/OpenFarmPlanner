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
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from '../../i18n';

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

const TOOLBAR_ARIA_LABEL_KEYS: Record<MarkdownFormat, string> = {
  bold: 'notesDrawer.markdownToolbar.bold',
  italic: 'notesDrawer.markdownToolbar.italic',
  code: 'notesDrawer.markdownToolbar.code',
  heading: 'notesDrawer.markdownToolbar.heading',
  'bullet-list': 'notesDrawer.markdownToolbar.bulletList',
  'numbered-list': 'notesDrawer.markdownToolbar.numberedList',
  link: 'notesDrawer.markdownToolbar.link',
  quote: 'notesDrawer.markdownToolbar.quote',
};

const TOOLBAR_TOOLTIP_KEYS: Record<MarkdownFormat, string> = {
  bold: 'notesDrawer.markdownToolbar.boldTooltip',
  italic: 'notesDrawer.markdownToolbar.italicTooltip',
  code: TOOLBAR_ARIA_LABEL_KEYS.code,
  heading: TOOLBAR_ARIA_LABEL_KEYS.heading,
  'bullet-list': TOOLBAR_ARIA_LABEL_KEYS['bullet-list'],
  'numbered-list': TOOLBAR_ARIA_LABEL_KEYS['numbered-list'],
  link: TOOLBAR_ARIA_LABEL_KEYS.link,
  quote: TOOLBAR_ARIA_LABEL_KEYS.quote,
};

const TOOLBAR_ACTIONS: Array<{ format: MarkdownFormat; icon: ReactNode; group: 'inline' | 'structure' | 'insert' }> = [
  { format: 'bold', icon: <FormatBoldIcon fontSize="small" />, group: 'inline' },
  { format: 'italic', icon: <FormatItalicIcon fontSize="small" />, group: 'inline' },
  { format: 'code', icon: <CodeIcon fontSize="small" />, group: 'inline' },
  { format: 'heading', icon: <TitleIcon fontSize="small" />, group: 'structure' },
  { format: 'bullet-list', icon: <FormatListBulletedIcon fontSize="small" />, group: 'structure' },
  { format: 'numbered-list', icon: <FormatListNumberedIcon fontSize="small" />, group: 'structure' },
  { format: 'link', icon: <LinkIcon fontSize="small" />, group: 'insert' },
  { format: 'quote', icon: <FormatQuoteIcon fontSize="small" />, group: 'insert' },
];

/**
 * Toolbar with markdown formatting buttons.
 */
export function MarkdownToolbar({ onFormat }: MarkdownToolbarProps): ReactElement {
  const { t } = useTranslation('common');

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
      {TOOLBAR_ACTIONS.map((action, index) => (
        <Box key={action.format} component="span" sx={{ display: 'inline-flex' }}>
          {index > 0 && TOOLBAR_ACTIONS[index - 1].group !== action.group ? (
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          ) : null}
          <Tooltip title={t(TOOLBAR_TOOLTIP_KEYS[action.format])}>
            <IconButton
              size="small"
              onClick={() => onFormat(action.format)}
              aria-label={t(TOOLBAR_ARIA_LABEL_KEYS[action.format])}
            >
              {action.icon}
            </IconButton>
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
}
