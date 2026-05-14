// Central MUI theme configuration
// Controls colors, shapes, and component style overrides.
import { alpha, createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

const theme = createTheme({
  typography: {
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 600,
    },
    subtitle2: {
      fontWeight: 600,
    },
    body1: {
      fontWeight: 400,
    },
    body2: {
      fontWeight: 400,
    },
    caption: {
      fontWeight: 400,
    },
  },
  palette: {
    // Primary color used by contained buttons and primary components
    primary: {
      main: '#256f2a',
      dark: '#1b5e20',
      light: '#4f9853',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#256f2a',
      dark: '#1b5e20',
      light: '#4f9853',
      contrastText: '#ffffff',
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

    MuiDialogContent: {
      styleOverrides: {
        root: {
          '.MuiDialogTitle-root + &': {
            paddingTop: 12,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        // Apply consistent padding and disable uppercase labels
        root: {
          padding: '8px 24px',
          textTransform: 'none',
          fontSize: '0.95rem',
          fontWeight: 600,
          lineHeight: 1.3,
        },
        containedPrimary: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1f6224',
          },
        },
        outlined: ({ theme }) => ({
          color: theme.palette.primary.main,
          borderColor: theme.palette.primary.main,
          '&:hover': {
            color: theme.palette.primary.dark,
            borderColor: theme.palette.primary.dark,
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.palette.primary.light}`,
            outlineOffset: 2,
          },
          '&:active': {
            color: theme.palette.primary.dark,
            borderColor: theme.palette.primary.dark,
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
          },
          '&.Mui-disabled': {
            borderColor: theme.palette.action.disabledBackground,
            color: theme.palette.action.disabled,
          },
        }),
        outlinedSecondary: ({ theme }) => ({
          color: theme.palette.secondary.main,
          borderColor: theme.palette.secondary.main,
          '&:hover': {
            color: theme.palette.secondary.dark,
            borderColor: theme.palette.secondary.dark,
            backgroundColor: alpha(theme.palette.secondary.main, 0.08),
          },
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.palette.secondary.light}`,
            outlineOffset: 2,
          },
          '&:active': {
            color: theme.palette.secondary.dark,
            borderColor: theme.palette.secondary.dark,
            backgroundColor: alpha(theme.palette.secondary.main, 0.12),
          },
        }),
        startIcon: {
          display: 'inline-flex',
          alignItems: 'center',
        },
        endIcon: {
          display: 'inline-flex',
          alignItems: 'center',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontWeight: 400,
        },
        secondary: {
          fontWeight: 400,
          color: 'rgba(47, 58, 51, 0.66)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardInfo: {
          backgroundColor: 'rgba(33, 150, 243, 0.08)',
          color: '#24435f',
        },
        standardSuccess: {
          backgroundColor: 'rgba(76, 175, 80, 0.10)',
          color: '#2f5a35',
        },
        standardWarning: {
          backgroundColor: 'rgba(237, 108, 2, 0.10)',
          color: '#75491e',
        },
        standardError: {
          backgroundColor: 'rgba(211, 47, 47, 0.09)',
          color: '#6e2c2c',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
        },
        body: {
          fontWeight: 400,
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        columnHeaderTitle: {
          fontWeight: 600,
        },
        cell: {
          fontWeight: 400,
        },
      },
    },
  },
});

export default theme;
