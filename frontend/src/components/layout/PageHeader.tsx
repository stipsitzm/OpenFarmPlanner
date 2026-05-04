import { Box, Typography } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  help?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  marginBottom?: number;
}

/**
 * Renders a shared page header with a left-aligned title and right-aligned actions.
 *
 * @param props - Component properties.
 * @param props.title - Page title content.
 * @param props.actions - Optional actions area rendered on the right side.
 * @param props.marginBottom - Spacing below the header.
 * @returns JSX element with responsive header layout.
 */
export default function PageHeader({
  title,
  help,
  description,
  actions,
  marginBottom = 2,
}: PageHeaderProps): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 1, sm: 2 },
        mb: marginBottom,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h5" component="h1" sx={{ lineHeight: 1.2 }}>
            {title}
          </Typography>
          {help}
        </Box>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minWidth: { sm: 220 },
            justifyContent: 'flex-end',
            width: { xs: '100%', sm: 'auto' },
            alignSelf: { xs: 'flex-end', sm: 'auto' },
          }}
        >
          {actions}
        </Box>
      ) : null}
    </Box>
  );
}
