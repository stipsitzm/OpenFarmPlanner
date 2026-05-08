import type { SxProps, Theme } from '@mui/material/styles';

const resolveInactiveBorderColor = (theme: Theme): string =>
  theme.palette.mode === 'light' ? theme.palette.grey[400] : theme.palette.grey[700];

const resolveInactiveHoverBorderColor = (theme: Theme): string =>
  theme.palette.mode === 'light' ? theme.palette.grey[500] : theme.palette.grey[500];

export const segmentedButtonGroupSx: SxProps<Theme> = {
  gap: 0,
  '& .MuiButtonGroup-grouped': {
    borderColor: (theme) => resolveInactiveBorderColor(theme),
    '&:not(:last-of-type)': {
      borderRightColor: (theme) => resolveInactiveBorderColor(theme),
    },
  },
};

export const getSegmentedActionButtonSx = ({
  active,
  hidden = false,
}: {
  active: boolean;
  hidden?: boolean;
}): SxProps<Theme> => ({
  textTransform: 'none',
  whiteSpace: 'nowrap',
  minWidth: 0,
  px: 1.25,
  visibility: hidden ? 'hidden' : 'visible',
  pointerEvents: hidden ? 'none' : 'auto',
  borderColor: (theme) =>
    active ? theme.palette.success.dark : resolveInactiveBorderColor(theme),
  backgroundColor: (theme) =>
    active ? theme.palette.success.main : theme.palette.background.paper,
  color: (theme) =>
    active ? theme.palette.success.contrastText : theme.palette.text.primary,
  '&:hover': {
    borderColor: (theme) =>
      active ? theme.palette.success.dark : resolveInactiveHoverBorderColor(theme),
    backgroundColor: (theme) =>
      active ? theme.palette.success.dark : theme.palette.action.hover,
  },
  '&.Mui-focusVisible': {
    outline: (theme) => `2px solid ${theme.palette.success.light}`,
    outlineOffset: -1,
  },
});

export const segmentedToggleButtonGroupSx: SxProps<Theme> = {
  '& .MuiToggleButtonGroup-grouped': {
    borderColor: (theme) => resolveInactiveBorderColor(theme),
    '&:not(:first-of-type)': {
      marginLeft: 0,
      borderLeftColor: (theme) => resolveInactiveBorderColor(theme),
    },
  },
};

export const segmentedToggleButtonSx: SxProps<Theme> = {
  textTransform: 'none',
  minWidth: 0,
  px: 1.5,
  borderColor: (theme) => resolveInactiveBorderColor(theme),
  color: 'text.primary',
  backgroundColor: 'background.paper',
  '&:hover': {
    borderColor: (theme) => resolveInactiveHoverBorderColor(theme),
    backgroundColor: 'action.hover',
  },
  '&.Mui-selected': {
    borderColor: 'success.dark',
    backgroundColor: 'success.main',
    color: 'success.contrastText',
  },
  '&.Mui-selected:hover': {
    borderColor: 'success.dark',
    backgroundColor: 'success.dark',
  },
  '&.Mui-focusVisible': {
    outline: (theme) => `2px solid ${theme.palette.success.light}`,
    outlineOffset: -1,
  },
};
