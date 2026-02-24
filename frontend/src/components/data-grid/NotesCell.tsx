/**
 * NotesCell component for rendering notes field in DataGrid.
 */

import type { MouseEvent } from 'react';
import { Badge, Box, IconButton, Tooltip, Typography } from '@mui/material';
import NotesIcon from '@mui/icons-material/Notes';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../../i18n';

export interface NotesCellProps {
  hasValue: boolean;
  excerpt: string;
  rawValue: string;
  onOpen: () => void;
  attachmentCount?: number;
  onOpenAttachments?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function NotesCell({
  hasValue,
  excerpt,
  rawValue,
  onOpen,
  attachmentCount = 0,
  onOpenAttachments,
}: NotesCellProps): React.ReactElement {
  const { t } = useTranslation('common');

  const firstLine = excerpt.split('\n')[0];
  const displayText = firstLine.length > 40 ? `${firstLine.substring(0, 37)}...` : firstLine;
  const hasMore = excerpt.length > firstLine.length || firstLine.length > 40;

  const tooltipMarkdown = rawValue.length > 2000 ? rawValue.substring(0, 2000) + '\n\n...' : rawValue;

  const tooltipContent = hasValue ? (
    <Box
      sx={{
        maxWidth: 480,
        maxHeight: 280,
        overflowY: 'auto',
        p: 1.5,
        pointerEvents: 'none',
        '& p': { margin: '0.5em 0' },
        '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '0.5em 0', fontSize: '1.1em' },
        '& ul, & ol': { margin: '0.5em 0', paddingLeft: 2 },
        '& code': {
          backgroundColor: 'rgba(255,255,255,0.1)',
          padding: '0.1em 0.3em',
          borderRadius: 0.5,
          fontSize: '0.85em',
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ html: () => null }}
      >
        {tooltipMarkdown}
      </ReactMarkdown>
    </Box>
  ) : (
    <Typography variant="body2">{t('notes.empty')}</Typography>
  );

  const notesAria = hasValue ? t('notes.editWithContent') : t('notes.editEmpty');
  const attachmentTooltip = attachmentCount === 1
    ? '1 Foto in Notizen'
    : `${attachmentCount} Fotos in Notizen`;

  return (
    <Tooltip title={tooltipContent} placement="top-start" arrow enterDelay={500}>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          py: 0.25,
          position: 'relative',
          minHeight: 32,
        }}
      >
        <IconButton
          size="small"
          onClick={onOpen}
          aria-label={notesAria}
          sx={{ p: 0.5 }}
        >
          {hasValue ? (
            <NotesIcon fontSize="small" color="primary" />
          ) : (
            <NotesOutlinedIcon fontSize="small" color="disabled" />
          )}
        </IconButton>

        <Typography
          variant="body2"
          sx={{
            color: hasValue ? 'text.primary' : 'text.disabled',
            fontStyle: hasValue ? 'normal' : 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexGrow: 1,
            pr: attachmentCount > 0 ? 3.5 : 0,
          }}
        >
          {hasValue ? displayText : t('notes.empty')}
          {hasValue && hasMore ? ' ...' : ''}
        </Typography>

        {attachmentCount > 0 && onOpenAttachments && (
          <Tooltip title={attachmentTooltip} arrow>
            <IconButton
              size="small"
              onClick={(event) => { event.stopPropagation(); event.preventDefault(); onOpenAttachments(event); }}
              aria-label={attachmentTooltip}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 24,
                height: 24,
                p: 0,
                bgcolor: 'background.paper',
              }}
            >
              <Badge
                color="primary"
                badgeContent={attachmentCount > 1 ? attachmentCount : undefined}
                overlap="circular"
              >
                <PhotoLibraryIcon fontSize="small" color="action" />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Tooltip>
  );
}
