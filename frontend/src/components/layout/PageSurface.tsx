import type { ReactElement, ReactNode } from 'react';
import { Box } from '@mui/material';

type PageSurfaceVariant = 'standardCenteredPage' | 'compactCenteredTable' | 'wideWorkspace';

interface PageSurfaceProps {
  children: ReactNode;
  variant: PageSurfaceVariant;
  sx?: Record<string, unknown>;
}

const VARIANT_SX: Record<PageSurfaceVariant, Record<string, unknown>> = {
  standardCenteredPage: { width: '100%' },
  compactCenteredTable: { width: 'fit-content', maxWidth: '100%', mx: 'auto' },
  wideWorkspace: { width: '100%', maxWidth: '100%' },
};

export default function PageSurface({ children, variant, sx }: PageSurfaceProps): ReactElement {
  return (
    <Box sx={{ ...VARIANT_SX[variant], ...sx }}>
      {children}
    </Box>
  );
}
