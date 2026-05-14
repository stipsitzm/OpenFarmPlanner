/**
 * Centralized navigation styling configuration.
 * 
 * Defines colors and styles for sidebar navigation to ensure consistency
 * across desktop, mobile, expanded, and collapsed states.
 * 
 * Color scheme:
 * - Inactive items use neutral dark gray (near-black) for text and icons
 * - Green is reserved exclusively for active/important states
 * - Hover state uses very subtle light-green background effect
 * - Active state uses dark green with light green background
 */

export const NAVIGATION_COLORS = {
  // Neutral colors for inactive state
  inactive: {
    text: '#2f3a33', // Neutral dark gray / near-black
    icon: '#475652', // Slightly lighter neutral gray
    background: 'transparent',
    hover: {
      text: '#2f3a33', // Same as inactive (no text color change on hover)
      icon: '#394145', // Slightly darker on hover
      background: 'rgba(79, 89, 86, 0.06)', // Very subtle neutral hover
      border: 'rgba(79, 89, 86, 0.08)',
    },
  },
  // Active state - green accent
  active: {
    text: '#2d5a3d', // Dark green
    icon: '#2d5a3d', // Dark green  
    background: 'rgba(76, 135, 86, 0.12)', // Light green background
    border: 'rgba(76, 135, 86, 0.18)',
    accentBar: 'rgba(59, 116, 72, 0.52)', // Dark green accent bar
    hover: {
      background: 'rgba(76, 135, 86, 0.16)', // Slightly darker on hover
      border: 'rgba(76, 135, 86, 0.24)',
    },
  },
  // Sidebar container colors
  sidebar: {
    background: '#f5f2eb',
    border: '#e1dbd0',
    logo: {
      text: '#2f3a33',
      hoverBackground: 'rgba(79, 89, 86, 0.06)',
    },
    toggleButton: {
      icon: '#4e5a53',
      hoverBackground: 'rgba(79, 89, 86, 0.06)',
    },
  },
  // Mobile drawer colors
  drawer: {
    background: '#f5f2eb',
    border: '#e1dbd0',
  },
};

export const NAVIGATION_TRANSITIONS = {
  fast: 'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
  icon: 'color 140ms ease',
} as const;

/**
 * Navigation item styling utilities
 */
export const getNavigationItemSx = (isActive: boolean, sidebarCollapsed: boolean = false) => ({
  minHeight: 44,
  borderRadius: 1.5,
  mb: 0.75,
  px: 1.25,
  justifyContent: sidebarCollapsed ? 'center' : 'initial',
  color: isActive ? NAVIGATION_COLORS.active.text : NAVIGATION_COLORS.inactive.text,
  bgcolor: isActive ? NAVIGATION_COLORS.active.background : NAVIGATION_COLORS.inactive.background,
  border: '1px solid rgba(76, 135, 86, 0)',
  position: 'relative',
  transition: NAVIGATION_TRANSITIONS.fast,
  '&:hover': {
    bgcolor: isActive 
      ? NAVIGATION_COLORS.active.hover.background 
      : NAVIGATION_COLORS.inactive.hover.background,
    color: isActive ? NAVIGATION_COLORS.active.text : NAVIGATION_COLORS.inactive.hover.text,
    borderColor: isActive 
      ? NAVIGATION_COLORS.active.hover.border 
      : NAVIGATION_COLORS.inactive.hover.border,
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 999,
    bgcolor: isActive ? NAVIGATION_COLORS.active.accentBar : 'transparent',
  },
});

export const getNavigationIconSx = (isActive: boolean, sidebarCollapsed?: boolean) => ({
  minWidth: sidebarCollapsed ? 0 : 36,
  color: isActive ? NAVIGATION_COLORS.active.icon : NAVIGATION_COLORS.inactive.icon,
  transition: NAVIGATION_TRANSITIONS.icon,
});

/**
 * Mobile drawer navigation item styling
 */
export const getMobileNavigationItemSx = (isActive: boolean) => ({
  justifyContent: 'flex-start',
  borderRadius: 0,
  px: 2,
  py: 1.5,
  color: isActive ? NAVIGATION_COLORS.active.text : NAVIGATION_COLORS.inactive.text,
  bgcolor: isActive ? NAVIGATION_COLORS.active.background : NAVIGATION_COLORS.inactive.background,
  transition: NAVIGATION_TRANSITIONS.fast,
  '&:hover': {
    bgcolor: isActive
      ? NAVIGATION_COLORS.active.hover.background
      : NAVIGATION_COLORS.inactive.hover.background,
    color: isActive ? NAVIGATION_COLORS.active.text : NAVIGATION_COLORS.inactive.hover.text,
  },
});

export const getMobileNavigationIconSx = (isActive: boolean) => ({
  minWidth: 36,
  color: isActive ? NAVIGATION_COLORS.active.icon : NAVIGATION_COLORS.inactive.icon,
  transition: NAVIGATION_TRANSITIONS.icon,
});
