import type { ReactElement, ReactNode } from 'react';
import { Box } from '@mui/material';

// Visual regression checklist for table-like surfaces:
// 1) Is the page container centered/workspace as intended?
// 2) Is the visible surface centered when using compact/contentFit?
// 3) Does the surface width match content (contentFit/compact) or intentionally fill width (fullWorkspace)?
// 4) Is max-width capped at 100% with horizontal overflow handled by the table/grid?
// 5) Are there no extra page-local fit-content/full-width wrapper hacks?
type PageSurfaceVariant = 'standardCenteredPage' | 'compact' | 'contentFit' | 'fullWorkspace' | 'compactCenteredTable' | 'wideWorkspace';

interface PageSurfaceProps {
  children: ReactNode;
  variant: PageSurfaceVariant;
  sx?: Record<string, unknown>;
}

const VARIANT_SX: Record<PageSurfaceVariant, Record<string, unknown>> = {
  standardCenteredPage: { width: '100%' },
  compact: { width: { xs: '100%', sm: 'fit-content' }, maxWidth: '100%', mx: { xs: 0, sm: 'auto' } },
  contentFit: { width: { xs: '100%', sm: 'fit-content' }, maxWidth: '100%', mx: { xs: 0, sm: 'auto' } },
  fullWorkspace: { width: '100%', maxWidth: '100%' },
  // Legacy aliases
  compactCenteredTable: { width: { xs: '100%', sm: 'fit-content' }, maxWidth: '100%', mx: { xs: 0, sm: 'auto' } },
  wideWorkspace: { width: '100%', maxWidth: '100%' },
};

export default function PageSurface({ children, variant, sx }: PageSurfaceProps): ReactElement {
  return (
    <Box sx={{ ...VARIANT_SX[variant], ...sx }}>
      {children}
    </Box>
  );
}
