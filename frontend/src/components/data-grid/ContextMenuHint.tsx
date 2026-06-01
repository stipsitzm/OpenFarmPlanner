import CloseIcon from '@mui/icons-material/Close';
import MouseOutlinedIcon from '@mui/icons-material/MouseOutlined';
import { Box, IconButton, Typography, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';

interface ContextMenuHintProps {
  message: ReactNode;
  secondary?: ReactNode;
  onClose?: () => void;
  compact?: boolean;
  sx?: SxProps<Theme>;
}

export function ContextMenuHint({
  message,
  secondary,
  onClose,
  compact = false,
  sx,
}: ContextMenuHintProps): React.ReactElement {
  const { t } = useTranslation('common');

  return (
    <Box
      role="note"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        maxWidth: '100%',
        px: compact ? 1 : 1.25,
        py: compact ? 0.625 : 0.75,
        border: '1px solid',
        borderColor: 'surface.surfaceSoftBorder',
        borderRadius: 1.5,
        bgcolor: 'surface.surfaceSubtleBackground',
        color: 'text.secondary',
        boxShadow: 'none',
        ...sx,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          width: compact ? 22 : 24,
          height: compact ? 22 : 24,
          borderRadius: '50%',
          color: 'success.main',
          bgcolor: 'success.50',
        }}
      >
        <MouseOutlinedIcon sx={{ fontSize: compact ? 15 : 16 }} />
      </Box>
      <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.35 }}>
          {message}
        </Typography>
        {secondary ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.35 }}>
            {secondary}
          </Typography>
        ) : null}
      </Box>
      {onClose ? (
        <IconButton
          size="small"
          aria-label={t('actions.close')}
          onClick={onClose}
          sx={{
            flex: '0 0 auto',
            ml: 0.25,
            width: 24,
            height: 24,
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.hover',
              color: 'text.primary',
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      ) : null}
    </Box>
  );
}
