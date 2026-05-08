import type { ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

interface BottomActionToolbarProps {
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  sx?: SxProps<Theme>;
}

const buttonAlignmentSx: SxProps<Theme> = {
  '& .MuiButton-root': {
    minHeight: 40,
    alignSelf: 'stretch',
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 1.2,
    mt: 0,
    transform: 'none',
  },
};

export default function BottomActionToolbar({ leftActions, rightActions, sx }: BottomActionToolbarProps) {
  return (
    <Box
      sx={[
        {
          borderTop: '1px solid #e5e7eb',
          bgcolor: '#f8faf8',
          px: { xs: 1.25, md: 1.5 },
          py: 1.25,
          borderRadius: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={[
          {
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          },
          buttonAlignmentSx,
        ]}
      >
        {leftActions}
      </Box>
      <Box
        sx={[
          {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
            ml: { md: 'auto' },
          },
          buttonAlignmentSx,
        ]}
      >
        {rightActions}
      </Box>
    </Box>
  );
}
