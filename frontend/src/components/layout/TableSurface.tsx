import type { ReactElement, ReactNode } from 'react';
import { Box, Paper } from '@mui/material';

export type TableSizingMode = 'compact' | 'contentFit' | 'fullWorkspace';

interface TableSurfaceProps {
  sizingMode: TableSizingMode;
  children: ReactNode;
}

const shellByMode: Record<TableSizingMode, Record<string, unknown>> = {
  compact: { width: '100%', display: 'flex', justifyContent: 'center', overflowX: 'auto' },
  contentFit: { width: '100%', display: 'flex', justifyContent: 'center', overflowX: 'auto' },
  fullWorkspace: { width: '100%', display: 'block', overflowX: 'auto' },
};

const paperByMode: Record<TableSizingMode, Record<string, unknown>> = {
  compact: { width: 'fit-content', maxWidth: '100%' },
  contentFit: { width: 'fit-content', maxWidth: '100%' },
  fullWorkspace: { width: '100%', maxWidth: '100%' },
};

export default function TableSurface({ sizingMode, children }: TableSurfaceProps): ReactElement {
  return (
    <Box sx={shellByMode[sizingMode]}>
      <Paper
        variant="outlined"
        sx={{
          ...paperByMode[sizingMode],
          borderRadius: 2,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
          '& .MuiTableContainer-root': { width: 'fit-content', maxWidth: '100%' },
          '& .MuiTable-root': { width: 'auto' },
          '& .MuiTableCell-head': { fontWeight: 600 },
        }}
      >
        {children}
      </Paper>
    </Box>
  );
}
