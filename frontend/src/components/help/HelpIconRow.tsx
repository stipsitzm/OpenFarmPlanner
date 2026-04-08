import { Box, Typography } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';

interface HelpIconRowProps {
  icon: ReactNode;
  text: string;
}

/**
 * Renders a standardized icon + text row for contextual help lists.
 *
 * @param props - Component properties.
 * @param props.icon - Icon element rendered on the left side.
 * @param props.text - Localized help text rendered on the right side.
 * @returns JSX element with aligned icon and help text.
 */
export default function HelpIconRow({ icon, text }: HelpIconRowProps): ReactElement {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 20,
        flexWrap: 'nowrap',
        width: '100%',
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          minWidth: 34,
          whiteSpace: 'nowrap',
        }}
      >
        {icon}
      </Box>
      <Typography variant="body2" component="span">
        {text}
      </Typography>
    </Box>
  );
}
