import { Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface AppLogoProps {
  to?: string;
  size?: number;
  showText?: boolean;
}

export default function AppLogo({ to = '/app/dashboard', size = 28, showText = true }: AppLogoProps): React.ReactElement {

  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
        px: 0.75,
        py: 0.35,
        borderRadius: 1,
        border: '1px solid transparent',
        transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        '&:focus-visible': {
          outline: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.35)',
        },
      }}
      aria-label="Zur Übersicht"
      title="Zur Übersicht"
    >
      <Box
        component="img"
        src="/favicon.png"
        alt="OpenFarmPlanner"
        sx={{ height: size, width: size, borderRadius: 0.5, flexShrink: 0 }}
      />
      {showText ? (
        <Box component="span" sx={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          OpenFarmPlanner
        </Box>
      ) : null}
    </Box>
  );
}
