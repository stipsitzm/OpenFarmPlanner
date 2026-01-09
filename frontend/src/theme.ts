// Central MUI theme configuration
// Controls colors, shapes, and component style overrides.
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    // Primary color used by contained buttons and primary components
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
    error: {
      main: '#d32f2f',
    },
  },
  shape: {
    // Global border radius (affects Button, TextField, etc.)
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        // Apply consistent padding and disable uppercase labels
        root: {
          padding: '8px 24px',
          textTransform: 'none',
        },
      },
    },
  },
});

export default theme;
