/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, RouterProvider, Outlet, NavLink, Link as RouterLink, redirect, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Drawer,
  ListItemButton,
  ListItemIcon,
  Toolbar,
  Tooltip,
  Typography,
  Box,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from './i18n';
import { useCommandContext, useRegisterCommands } from './commands/useCommandContext';
import { createRootCommands } from './commands/commands';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import LocalFloristOutlinedIcon from '@mui/icons-material/LocalFloristOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PublicIcon from '@mui/icons-material/Public';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import { cultureAPI, projectAPI } from './api/api';
import type { CultureHistoryEntry } from './api/types';
import './App.css';
import { useAuth } from './auth/useAuth';
import ProtectedRoute from './auth/ProtectedRoute';
import AppLogo from './components/layout/AppLogo';
import { HelpDialog } from './components/help/HelpDialog';
import PageHelp from './components/help/PageHelp';
import {
  getSegmentedActionButtonSx,
  segmentedButtonGroupSx,
} from './components/buttons/segmentedControlStyles';
import { buildInvitationAcceptPath } from './pages/invitationAcceptance';
import { getHistoryEntryTarget, getHistoryEntryTitle } from './pages/culturesHistoryUtils';
import { resolveRouterBasename } from './routerBasename';
import { OPEN_CREATE_PROJECT_EVENT } from './projects/projectCreationFlow';
import { KEYBOARD_NAV_ROUTES, MAIN_NAV_ITEMS, normalizeMainRoutePath } from './navigation/mainNavigation';
import { PanelLeft } from 'lucide-react';

const CONTENT_ALIGNMENT_MODE = 'centered';
const ACTION_MENU_ITEM_ICON_SX = { minWidth: 32, color: 'text.secondary' } as const;
const ACTION_MENU_ICON_PROPS = { fontSize: 'small' } as const;
const HomePage = React.lazy(() => import('./pages/public/HomePage'));
const ImprintPage = React.lazy(() => import('./pages/public/ImprintPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/public/PrivacyPolicyPage'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'));
const ActivatePage = React.lazy(() => import('./pages/auth/ActivatePage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage'));
const ConfirmEmailChangePage = React.lazy(() => import('./pages/auth/ConfirmEmailChangePage'));
const ProjectSelectionPage = React.lazy(() => import('./pages/ProjectSelectionPage'));
const AccountSettingsPage = React.lazy(() => import('./pages/AccountSettingsPage'));
const ProjectSettingsPage = React.lazy(() => import('./pages/ProjectSettingsPage'));
const InvitationAcceptPage = React.lazy(() => import('./pages/InvitationAcceptPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Locations = React.lazy(() => import('./pages/Locations'));
const FieldsBedsPage = React.lazy(() => import('./pages/FieldsBedsPage'));
const Cultures = React.lazy(() => import('./pages/Cultures'));
const PlantingPlans = React.lazy(() => import('./pages/PlantingPlans'));
const GanttChart = React.lazy(() => import('./pages/GanttChart'));
const SeedDemandPage = React.lazy(() => import('./pages/SeedDemand'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

interface ProjectMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  memberships: { project_id: number; project_name: string; role: 'admin' | 'member' }[];
  activeProjectId: number | null;
  isSwitchingProject: boolean;
  onClose: () => void;
  onSwitchProject: (projectId: number) => Promise<void>;
  onOpenProjectSettings: () => void;
  onOpenCreateProject: () => void;
  t: (key: string) => string;
}

function ProjectMenu(props: ProjectMenuProps): React.ReactElement {
  const {
    anchorEl,
    open,
    memberships,
    activeProjectId,
    isSwitchingProject,
    onClose,
    onSwitchProject,
    onOpenProjectSettings,
    onOpenCreateProject,
    t,
  } = props;

  return (
    <Menu
      id="project-switcher-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
    >
      {memberships.length === 0 ? (
        <MenuItem disabled>{t('projectSwitcher.zeroProjects')}</MenuItem>
      ) : (
        memberships.map((membership) => (
          <MenuItem
            key={membership.project_id}
            onClick={() => void onSwitchProject(membership.project_id)}
            selected={membership.project_id === activeProjectId}
            disabled={isSwitchingProject}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{membership.project_name}</span>
              {membership.project_id === activeProjectId ? <CheckIcon fontSize="small" /> : null}
            </Stack>
          </MenuItem>
        ))
      )}
      <Divider />
      <MenuItem onClick={onOpenProjectSettings}>
        <ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>
        {t('project.settings')}
      </MenuItem>
      <Divider />
      <MenuItem onClick={onOpenCreateProject}>
        <ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><AddIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>
        {t('project.create')}
      </MenuItem>
    </Menu>
  );
}

interface GlobalMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  historyLoading: boolean;
  userLabel: string;
  isMobile: boolean;
  onClose: () => void;
  onOpenProjectSwitcher: () => void;
  onOpenCreateProject: () => void;
  onOpenProjectSettings: () => void;
  onOpenProjectMembers: () => void;
  onOpenProjectHistory: () => Promise<void>;
  onOpenAccountSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenHelp: () => void;
  onLogout: () => Promise<void>;
  t: (key: string) => string;
}

function GlobalMenu(props: GlobalMenuProps): React.ReactElement {
  const {
    anchorEl,
    open,
    historyLoading,
    userLabel,
    isMobile,
    onClose,
    onOpenProjectSwitcher,
    onOpenCreateProject,
    onOpenProjectSettings,
    onOpenProjectMembers,
    onOpenProjectHistory,
    onOpenAccountSettings,
    onOpenShortcuts,
    onOpenHelp,
    onLogout,
    t,
  } = props;

  const mobileMenuItems = [
    <MenuItem key="mobile-section-project" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Projektaktionen</MenuItem>,
    <MenuItem key="mobile-project-switcher" onClick={onOpenProjectSwitcher}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SwapHorizIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('projectSwitcher.ariaLabel')}</MenuItem>,
    <MenuItem key="mobile-project-create" onClick={onOpenCreateProject}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><AddIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.create')}</MenuItem>,
    <MenuItem key="mobile-project-settings" onClick={onOpenProjectSettings}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.settings')}</MenuItem>,
    <MenuItem key="mobile-project-members" onClick={onOpenProjectMembers}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><GroupOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.openProjectMembers')}</MenuItem>,
    <MenuItem key="mobile-project-history" onClick={() => void onOpenProjectHistory()} disabled={historyLoading}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HistoryOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.openVersionHistory')}</MenuItem>,
    <Divider key="mobile-divider-project-app" />,
    <MenuItem key="mobile-section-app" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>App</MenuItem>,
    <MenuItem key="mobile-app-shortcuts" onClick={onOpenShortcuts}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><KeyboardOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>Tastenkürzel</MenuItem>,
    <MenuItem key="mobile-app-help" onClick={onOpenHelp}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HelpOutlineIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>App-Hilfe</MenuItem>,
    <MenuItem key="mobile-app-account-settings" onClick={onOpenAccountSettings}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('accountSettings')}</MenuItem>,
    <Divider key="mobile-divider-app-account" />,
    <MenuItem key="mobile-section-account" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Account</MenuItem>,
    <MenuItem key="mobile-account-logout" onClick={() => void onLogout()}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><LogoutIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.logout')} {userLabel}</MenuItem>,
  ];
  const desktopMenuItems = [
    <MenuItem key="desktop-history" onClick={() => void onOpenProjectHistory()} disabled={historyLoading}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HistoryOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.openVersionHistory')}</MenuItem>,
    <MenuItem key="desktop-account-settings" onClick={onOpenAccountSettings}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('accountSettings')}</MenuItem>,
    <MenuItem key="desktop-shortcuts" onClick={onOpenShortcuts}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><KeyboardOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>Tastenkürzel</MenuItem>,
    <MenuItem key="desktop-help" onClick={onOpenHelp}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HelpOutlineIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>App-Hilfe</MenuItem>,
    <MenuItem key="desktop-logout" onClick={() => void onLogout()}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><LogoutIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.logout')} {userLabel}</MenuItem>,
  ];
  return <Menu id="global-actions-menu" anchorEl={anchorEl} open={open} onClose={onClose}>{isMobile ? mobileMenuItems : desktopMenuItems}</Menu>;
}

export interface TopbarContextAction {
  id: string;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  shortcutHint?: string;
  active?: boolean;
  hidden?: boolean;
  reserveSpace?: boolean;
  groupId?: string;
  tooltip?: string;
}

export interface RootLayoutOutletContext {
  setTopbarContextActions: (actions: TopbarContextAction[]) => void;
}


/**
 * Root layout component with navigation.
 * Wraps all routes with the persistent navigation bar.
 */
function RootLayout(): React.ReactElement {
  const { t, i18n } = useTranslation('navigation');
  const tCultures = useMemo(
    () => i18n.getFixedT(i18n.resolvedLanguage ?? i18n.language ?? 'de', 'cultures'),
    [i18n],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktopUp = useMediaQuery(theme.breakpoints.up('md'));
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const isCoarseLowHeightViewport = useMediaQuery('(pointer: coarse) and (max-height: 500px)');
  const isCompactTopbar = isPhone || isCoarseLowHeightViewport;
  const isVeryNarrowMobile = useMediaQuery('(max-width:360px)');
  const isPhonePortrait = useMediaQuery(`${theme.breakpoints.down('sm')} and (orientation: portrait)`);
  const isTabletOrNarrowDesktop = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const { user, logout, activeProjectId, switchActiveProject } = useAuth();
  const fallbackHistoryActorLabel = user?.display_label || user?.display_name || user?.email || undefined;
  const { openPalette } = useCommandContext();
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<null | HTMLElement>(null);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileProjectSwitcherOpen, setMobileProjectSwitcherOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!isLargeDesktop);
  const [isSwitchingProject, setIsSwitchingProject] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [topbarContextActions, setTopbarContextActions] = useState<TopbarContextAction[]>([]);
  const [cultureActionsMenuAnchor, setCultureActionsMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileActionsOverflowAnchor, setMobileActionsOverflowAnchor] = useState<null | HTMLElement>(null);
  const navItems = useMemo(() => ([
    { to: '/app/dashboard', label: t('dashboard'), activeAliases: [], keywords: ['übersicht', 'dashboard'], icon: <DashboardOutlinedIcon fontSize="small" /> },
    ...MAIN_NAV_ITEMS.map((item) => ({
      to: item.to,
      label: t(item.labelKey),
      activeAliases: item.activeAliases ?? [],
      keywords: item.keywords,
      icon: item.to.includes('locations') ? <PlaceOutlinedIcon fontSize="small" />
        : item.to.includes('fields-beds') ? <GridViewOutlinedIcon fontSize="small" />
          : item.to.includes('cultures') ? <LocalFloristOutlinedIcon fontSize="small" />
            : item.to.includes('anbauplaene') ? <EventNoteOutlinedIcon fontSize="small" />
              : item.to.includes('gantt-chart') ? <CalendarMonthOutlinedIcon fontSize="small" />
                : item.to.includes('seed-demand') ? <ScienceOutlinedIcon fontSize="small" />
                  : <LocalShippingOutlinedIcon fontSize="small" />,
    })),
  ]), [t]);

  const handleGlobalMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setGlobalMenuAnchor(event.currentTarget);
  };

  const handleGlobalMenuClose = () => {
    setGlobalMenuAnchor(null);
  };
  const handleOpenMobileProjectSwitcher = (): void => {
    handleGlobalMenuClose();
    setMobileProjectSwitcherOpen(true);
  };
  const handleCloseMobileProjectSwitcher = (): void => {
    setMobileProjectSwitcherOpen(false);
  };

  const handleProjectMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProjectMenuAnchor(event.currentTarget);
  };

  const handleProjectMenuClose = useCallback(() => {
    setProjectMenuAnchor(null);
  }, []);
  const closeMobileNav = () => {
    setMobileNavOpen(false);
  };
  useEffect(() => {
    const storedValue = window.localStorage.getItem('openfarmplanner.sidebarCollapsed');
    if (storedValue !== null) {
      setSidebarCollapsed(storedValue === 'true');
    }
  }, []);

  const toggleSidebarCollapsed = (): void => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem('openfarmplanner.sidebarCollapsed', String(next));
      return next;
    });
  };

  const [projectHistoryOpen, setProjectHistoryOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [globalHelpOpen, setGlobalHelpOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<CultureHistoryEntry[]>([]);
  const [pendingRestoreEntry, setPendingRestoreEntry] = useState<CultureHistoryEntry | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleOpenProjectHistory = useCallback(async () => {
    handleGlobalMenuClose();
    setHistoryLoading(true);
    try {
      const response = await cultureAPI.projectHistory();
      setHistoryItems(response.data);
      setProjectHistoryOpen(true);
    } catch (error) {
      console.error('Error loading project history:', error);
      showSnackbar(t('commandPalette.feedback.versionHistoryLoadError'), 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [showSnackbar, t]);

  const handleRestoreProjectVersion = async (historyId: number) => {
    try {
      await cultureAPI.projectRestore(historyId);
      showSnackbar('Version wiederhergestellt. Die vorherige Version wurde automatisch gespeichert.', 'success');
      setProjectHistoryOpen(false);
      setPendingRestoreEntry(null);
      window.location.reload();
    } catch (error) {
      console.error('Error restoring project version:', error);
      showSnackbar(t('commandPalette.feedback.versionRestoreError'), 'error');
    }
  };

  const formatHistoryTimestamp = (value: string): string => new Date(value).toLocaleString('de-DE');

  const handleOpenShortcuts = () => {
    handleGlobalMenuClose();
    setShortcutsOpen(true);
  };

  const openCurrentPageHelp = useCallback((): void => {
    window.dispatchEvent(new CustomEvent('ofp:open-page-help'));
  }, []);
  const openGlobalHelp = (): void => {
    setGlobalHelpOpen(true);
  };
  const closeGlobalHelp = (): void => {
    setGlobalHelpOpen(false);
  };

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      await logout();
      handleGlobalMenuClose();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error logging out:', error);
      showSnackbar(t('commandPalette.feedback.logoutError'), 'error');
    }
  }, [logout, navigate, showSnackbar, t]);

  const memberships = useMemo(() => user?.memberships ?? [], [user?.memberships]);
  const activeMembership = memberships.find((membership) => membership.project_id === activeProjectId) ?? null;
  const activeProjectLabel = activeMembership?.project_name ?? t('projectSwitcher.noProject');


  const handleOpenCreateProject = useCallback((): void => {
    setProjectMenuAnchor(null);
    setNewProjectName('');
    setNewProjectDescription('');
    setIsCreateProjectOpen(true);
  }, []);

  useEffect(() => {
    const handleCreateProjectRequest = (): void => {
      handleOpenCreateProject();
    };
    window.addEventListener(OPEN_CREATE_PROJECT_EVENT, handleCreateProjectRequest);
    return () => window.removeEventListener(OPEN_CREATE_PROJECT_EVENT, handleCreateProjectRequest);
  }, [handleOpenCreateProject]);

  const handleOpenProjectSettings = useCallback((): void => {
    handleProjectMenuClose();
    navigate('/app/project-settings');
  }, [handleProjectMenuClose, navigate]);

  const applyProjectContextChange = useCallback(async (projectId: number): Promise<void> => {
    await switchActiveProject(projectId);
    window.location.reload();
  }, [switchActiveProject]);

  const closeCreateProjectDialog = (): void => {
    setIsCreateProjectOpen(false);
    setNewProjectName('');
    setNewProjectDescription('');
  };

  const navigateFromGlobalMenu = (path: string): void => {
    handleGlobalMenuClose();
    navigate(path);
  };
  const handleCultureActionsMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setCultureActionsMenuAnchor(event.currentTarget);
  };

  const handleCultureActionsMenuClose = () => {
    setCultureActionsMenuAnchor(null);
  };
  const handleMobileActionsOverflowOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileActionsOverflowAnchor(event.currentTarget);
  };
  const handleMobileActionsOverflowClose = () => {
    setMobileActionsOverflowAnchor(null);
  };
  const isCulturesPage = location.pathname.startsWith('/app/cultures');
  const cultureLibraryAction = useMemo(
    () => topbarContextActions.find((action) => action.id === 'cultures-open-library'),
    [topbarContextActions],
  );
  const cultureImportExportActions = useMemo(
    () => topbarContextActions.filter((action) => action.id !== 'cultures-open-library'),
    [topbarContextActions],
  );
  const fieldsGlobalAddAction = useMemo(
    () => topbarContextActions.find((action) => action.id === 'fields-global-add-field') ?? null,
    [topbarContextActions],
  );
  const genericTopbarContextActions = useMemo(
    () => (isCulturesPage ? [] : topbarContextActions.filter((action) => action.id !== 'fields-global-add-field')),
    [isCulturesPage, topbarContextActions],
  );
  const topbarModeControls = useMemo(
    () => genericTopbarContextActions.filter((action) => (
      action.groupId?.includes('mode')
      || action.id.includes('view-mode')
      || action.id.includes('interaction-mode')
      || action.id.includes('calendar-mode')
    )),
    [genericTopbarContextActions],
  );
  const topbarOverflowActions = useMemo(
    () => genericTopbarContextActions.filter((action) => !topbarModeControls.some((modeAction) => modeAction.id === action.id)),
    [genericTopbarContextActions, topbarModeControls],
  );
  const showCompactCultureLibrary = isCulturesPage && (isTabletOrNarrowDesktop || isPhone);
  const showIconOnlyCultureLibrary = isCulturesPage && (isPhone || isTabletOrNarrowDesktop);
  const showCultureImportExportButton = isCulturesPage;
  const showDesktopCultureActionsOverflow = isCulturesPage && !isPhone && !isLargeDesktop;
  const hasVisibleMobileContextActions = useMemo(
    () => [...topbarModeControls, ...topbarOverflowActions].some((action) => !action.hidden),
    [topbarModeControls, topbarOverflowActions],
  );
  const hasMobileSecondaryRow = useMemo(
    () => (
      (isCulturesPage && (Boolean(cultureLibraryAction) || showCultureImportExportButton))
      || hasVisibleMobileContextActions
    ),
    [cultureLibraryAction, hasVisibleMobileContextActions, isCulturesPage, showCultureImportExportButton],
  );
  const handleCreateProject = async (): Promise<void> => {
    if (!newProjectName.trim()) {
      return;
    }
    setIsCreatingProject(true);
    try {
      const response = await projectAPI.create({
        name: newProjectName.trim(),
        description: newProjectDescription.trim(),
      });
      closeCreateProjectDialog();
      navigate('/app/dashboard');
      await applyProjectContextChange(response.data.id);
    } catch (error) {
      console.error('Error creating project:', error);
      showSnackbar(t('projectSwitcher.createError'), 'error');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSwitchProject = useCallback(async (projectId: number): Promise<void> => {
    setMobileProjectSwitcherOpen(false);
    handleProjectMenuClose();
    if (projectId === activeProjectId) {
      return;
    }
    setIsSwitchingProject(true);
    try {
      await applyProjectContextChange(projectId);
    } catch (error) {
      console.error('Error switching project:', error);
      showSnackbar(t('projectSwitcher.switchError'), 'error');
    } finally {
      setIsSwitchingProject(false);
    }
  }, [activeProjectId, applyProjectContextChange, handleProjectMenuClose, showSnackbar, t]);

  const activeMembershipRole = activeMembership?.role ?? null;

  const getCurrentRouteFromLocation = useCallback((): string => {
    const pathname = window.location.pathname || location.pathname;
    return normalizeMainRoutePath(pathname);
  }, [location.pathname]);

  const navigateRelativePage = useCallback((direction: 1 | -1): void => {
    const currentRoute = getCurrentRouteFromLocation();
    const currentIndex = KEYBOARD_NAV_ROUTES.indexOf(currentRoute);

    if (currentIndex === -1) {
      console.warn(`[keyboard-nav] Unknown route "${currentRoute}" (pathname: "${window.location.pathname}"). Falling back to dashboard.`);
      navigate('/app/dashboard');
      return;
    }

    const nextIndex = (currentIndex + direction + KEYBOARD_NAV_ROUTES.length) % KEYBOARD_NAV_ROUTES.length;
    navigate(KEYBOARD_NAV_ROUTES[nextIndex]);
  }, [getCurrentRouteFromLocation, navigate]);

  const goToNextPage = useCallback((): void => {
    navigateRelativePage(1);
  }, [navigateRelativePage]);

  const goToPreviousPage = useCallback((): void => {
    navigateRelativePage(-1);
  }, [navigateRelativePage]);

  const globalCommands = useMemo(() => createRootCommands({
    currentPath: normalizeMainRoutePath(location.pathname),
    activeProjectId,
    isProjectAdmin: activeMembershipRole === 'admin',
    memberships,
    onNextPage: goToNextPage,
    onPreviousPage: goToPreviousPage,
    onOpenProjectSettings: handleOpenProjectSettings,
    onOpenProjectMembers: handleOpenProjectSettings,
    onOpenCreateProject: handleOpenCreateProject,
    onSwitchProject: (projectId) => { void handleSwitchProject(projectId); },
    onOpenAccountSettings: () => navigate('/app/account-settings'),
    onOpenVersionHistory: () => { void handleOpenProjectHistory(); },
    onLogout: () => { void handleLogout(); },
    onOpenPalette: openPalette,
    onOpenShortcuts: openCurrentPageHelp,
    labels: {
      nextPage: t('commandPalette.commands.nextPage'),
      previousPage: t('commandPalette.commands.previousPage'),
      openProjectSettings: t('commandPalette.commands.openProjectSettings'),
      openProjectMembers: t('commandPalette.commands.openProjectMembers'),
      createProject: t('commandPalette.commands.createProject'),
      switchProjectPrefix: t('commandPalette.commands.switchProjectPrefix'),
      openAccountSettings: t('commandPalette.commands.openAccountSettings'),
      openVersionHistory: t('commandPalette.commands.openVersionHistory'),
      logout: t('commandPalette.commands.logout'),
      openPalette: t('commandPalette.label'),
      openShortcuts: t('commandPalette.commands.openShortcuts'),
    },
  }), [
    activeMembershipRole,
    activeProjectId,
    goToNextPage,
    goToPreviousPage,
    handleLogout,
    handleOpenCreateProject,
    handleOpenProjectHistory,
    handleOpenProjectSettings,
    handleSwitchProject,
    location.pathname,
    memberships,
    navigate,
    openCurrentPageHelp,
    openPalette,
    t,
  ]);

  useRegisterCommands('global-app', globalCommands);

  useEffect(() => {
    const handleHelpShortcut = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target?.isContentEditable;
      if (isTypingTarget) {
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setGlobalHelpOpen(true);
      }
    };
    window.addEventListener('keydown', handleHelpShortcut);
    return () => window.removeEventListener('keydown', handleHelpShortcut);
  }, []);
  useEffect(() => {
    const handleSidebarShortcut = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target?.isContentEditable;
      if (isTypingTarget || !isDesktopUp) {
        return;
      }
      if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebarCollapsed();
      }
    };
    window.addEventListener('keydown', handleSidebarShortcut);
    return () => window.removeEventListener('keydown', handleSidebarShortcut);
  }, [isDesktopUp]);
  useEffect(() => {
    setSidebarCollapsed(!isLargeDesktop);
  }, [isLargeDesktop]);
  
  const sidebarWidth = sidebarCollapsed ? 64 : 240;
  const currentPageTitle = useMemo(() => {
    const activeItem = navItems.find((item) => location.pathname === item.to || item.activeAliases.includes(location.pathname));
    return activeItem?.label ?? '';
  }, [location.pathname, navItems]);
  const topbarHelpConfig = useMemo(() => {
    if (location.pathname.startsWith('/app/dashboard')) return { pageKey: 'dashboard' as const, label: 'Hilfe zu Übersicht' };
    if (location.pathname.startsWith('/app/locations')) return { pageKey: 'locations' as const, label: 'Hilfe zu Standorte' };
    if (location.pathname.startsWith('/app/fields-beds')) return { pageKey: 'areas' as const, label: 'Hilfe zu Anbauflächen' };
    if (location.pathname.startsWith('/app/cultures')) return { pageKey: 'cultures' as const, label: 'Hilfe zu Kulturen' };
    if (location.pathname.startsWith('/app/anbauplaene') || location.pathname.startsWith('/app/planting-plans')) return { pageKey: 'plantingPlans' as const, label: 'Hilfe zu Anbauplänen' };
    if (location.pathname.startsWith('/app/gantt-chart')) return { pageKey: 'calendar' as const, label: 'Hilfe zu Anbaukalender' };
    if (location.pathname.startsWith('/app/seed-demand')) return { pageKey: 'seedDemand' as const, label: 'Hilfe zu Saatgutbedarf' };
    if (location.pathname.startsWith('/app/suppliers')) return { pageKey: 'suppliers' as const, label: 'Hilfe zu Lieferanten' };
    return null;
  }, [location.pathname]);
  const topbarPrimaryAction = useMemo(() => {
    if (location.pathname.startsWith('/app/locations')) return { label: 'Standort hinzufügen', to: '/app/locations?create=true' };
    if (location.pathname.startsWith('/app/cultures')) return { label: 'Kultur hinzufügen', to: '/app/cultures?create=true' };
    if (location.pathname.startsWith('/app/anbauplaene') || location.pathname.startsWith('/app/planting-plans')) return { label: 'Anbauplan hinzufügen', to: '/app/planting-plans?create=true' };
    if (location.pathname.startsWith('/app/suppliers')) return { label: 'Lieferant hinzufügen', to: '/app/suppliers?create=true' };
    if (location.pathname.startsWith('/app/fields-beds')) return fieldsGlobalAddAction ? { label: fieldsGlobalAddAction.label, to: '', onClick: fieldsGlobalAddAction.onClick } : null;
    return null;
  }, [fieldsGlobalAddAction, location.pathname]);
  const handleTopbarPrimaryAction = useCallback((): void => {
    if (!topbarPrimaryAction) {
      return;
    }
    if (topbarPrimaryAction.onClick) {
      topbarPrimaryAction.onClick();
      return;
    }
    navigate(topbarPrimaryAction.to);
  }, [navigate, topbarPrimaryAction]);

  return (
    <Box className={`app app--${CONTENT_ALIGNMENT_MODE}`} sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f2f0ea' }}>
      {isDesktopUp ? (
        <Box component="aside" sx={{ width: sidebarWidth, flexShrink: 0, borderRight: '1px solid', borderColor: '#e1dbd0', bgcolor: '#f5f2eb', transition: 'width 0.25s ease', position: 'relative', overflow: 'visible' }}>
          <Stack sx={{ height: '100%' }}>
            {!sidebarCollapsed ? (
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, gap: 1 }}>
                <Box
                  component={RouterLink}
                  to="/app/dashboard"
                  aria-label="Zur Übersicht"
                  title="Zur Übersicht"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    minWidth: 0,
                    flex: 1,
                    borderRadius: 1,
                    px: 0.5,
                    py: 0.25,
                    textDecoration: 'none',
                    color: 'inherit',
                    '&:hover': { bgcolor: 'rgba(80, 120, 90, 0.08)' },
                    '&:focus-visible': {
                      outline: 'none',
                      boxShadow: '0 0 0 2px rgba(80, 130, 90, 0.22)',
                    },
                  }}
                >
                  <Box
                    component="img"
                    src="/favicon.png"
                    alt="OpenFarmPlanner"
                    sx={{ width: 24, height: 24, borderRadius: 0.5, flexShrink: 0 }}
                  />
                  <Typography
                    variant="subtitle2"
                    noWrap
                    sx={{ color: '#2F3A33', letterSpacing: 0.1 }}
                  >
                    OpenFarmPlanner
                  </Typography>
                </Box>
                <Tooltip
                  title="Seitenleiste schließen"
                  placement="right"
                  enterDelay={350}
                  slotProps={{ tooltip: { sx: { bgcolor: '#1F2A24', fontSize: '0.72rem', px: 1, py: 0.5 } } }}
                >
                  <IconButton
                    aria-label="Sidebar einklappen"
                    onClick={toggleSidebarCollapsed}
                    size="small"
                    sx={{
                      width: 30,
                      height: 30,
                      color: '#4E5A53',
                      cursor: 'w-resize',
                      '&:hover': { bgcolor: 'rgba(80, 120, 90, 0.08)' },
                    }}
                  >
                    <PanelLeft size={18} strokeWidth={1.8} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Stack direction="row" alignItems="center" justifyContent="center" sx={{ py: 1, mb: 0.75 }}>
                <Tooltip
                  title="Seitenleiste öffnen"
                  placement="right"
                  enterDelay={350}
                  slotProps={{ tooltip: { sx: { bgcolor: '#1F2A24', fontSize: '0.72rem', px: 1, py: 0.5 } } }}
                >
                  <IconButton
                    aria-label="Sidebar ausklappen"
                    onClick={toggleSidebarCollapsed}
                    size="small"
                    sx={{
                      width: 30,
                      height: 30,
                      color: '#4E5A53',
                      cursor: 'e-resize',
                      '&:hover': { bgcolor: 'rgba(80, 120, 90, 0.08)' },
                    }}
                  >
                    <PanelLeft size={18} strokeWidth={1.8} />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
            <List sx={{ px: 1, pt: 0.5 }}>
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || item.activeAliases.includes(location.pathname);
                const entry = (
                  <ListItemButton
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    selected={isActive}
                    sx={{
                      minHeight: 44,
                      borderRadius: 1.5,
                      mb: 0.75,
                      px: 1.25,
                      justifyContent: sidebarCollapsed ? 'center' : 'initial',
                      color: '#29332c',
                      bgcolor: isActive ? 'rgba(76, 135, 86, 0.13)' : 'transparent',
                      border: '1px solid rgba(76, 135, 86, 0)',
                      position: 'relative',
                      transition: 'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
                      '&:hover': {
                        bgcolor: isActive ? 'rgba(76, 135, 86, 0.16)' : 'rgba(91, 130, 102, 0.09)',
                        color: '#29332c',
                        borderColor: 'rgba(91, 130, 102, 0.14)',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: 999,
                        bgcolor: isActive ? 'rgba(59, 116, 72, 0.52)' : 'transparent',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: sidebarCollapsed ? 0 : 36, color: '#2c4f33', transition: 'color 140ms ease' }}>{item.icon}</ListItemIcon>
                    {!sidebarCollapsed ? <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: isActive ? 600 : 500, fontSize: '0.95rem' }} /> : null}
                  </ListItemButton>
                );
                return sidebarCollapsed ? <Tooltip key={item.to} title={item.label} placement="right">{entry}</Tooltip> : entry;
              })}
            </List>
          </Stack>
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', bgcolor: '#f2f0ea' }}>
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {navItems.map((item) => {
          const srLinkLabel = item.to === '/app/dashboard' ? 'Zur Übersicht' : item.label;
          return <RouterLink key={`sr-${item.to}`} to={item.to} aria-label={srLinkLabel}>{item.label}</RouterLink>;
        })}
      </Box>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: '#e4dfd4', bgcolor: '#f7f4ed', backdropFilter: 'saturate(120%) blur(2px)' }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 56, gap: 1, py: 0.5, px: { xs: 0, sm: 2, md: 3 }, flexWrap: 'nowrap', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          {!isDesktopUp ? <IconButton aria-label="Menü öffnen" onClick={() => setMobileNavOpen(true)} size="small"><MenuIcon fontSize="small" /></IconButton> : null}
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
            {!isDesktopUp ? (
              <Typography
                component="h1"
                variant="subtitle1"
                noWrap
                sx={{
                  minWidth: 0,
                  maxWidth: { xs: 180, sm: 220 },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '0.98rem', sm: '1.02rem' },
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {currentPageTitle}
              </Typography>
            ) : (
              <Typography component="h1" variant="h5" noWrap sx={{ minWidth: 0, maxWidth: { sm: 180, md: 260 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: { xs: '1rem', md: '1.25rem' }, fontWeight: 600 }}>
                {currentPageTitle}
              </Typography>
            )}
            {topbarHelpConfig ? <PageHelp pageKey={topbarHelpConfig.pageKey} ariaLabel={`${topbarHelpConfig.label} öffnen`} tooltip={topbarHelpConfig.label} /> : null}
          </Box>
          {!isCompactTopbar ? (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', minWidth: 0, maxWidth: '100%', flex: 1, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, justifyContent: 'flex-end', overflow: 'hidden', pr: 0.5 }}>
          {isCulturesPage ? (
            <>
              {cultureLibraryAction && !showDesktopCultureActionsOverflow ? (
                <Tooltip title="Kulturbibliothek öffnen">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => cultureLibraryAction.onClick()}
                      aria-label="Kulturbibliothek öffnen"
                      startIcon={<PublicIcon fontSize="small" />}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: showIconOnlyCultureLibrary ? 36 : 'auto', px: showIconOnlyCultureLibrary ? 0.75 : 1.25, flexShrink: 0 }}
                      disabled={cultureLibraryAction.disabled}
                    >
                      {!showIconOnlyCultureLibrary ? (showCompactCultureLibrary ? 'Bibliothek' : 'Kulturbibliothek') : null}
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              {(showCultureImportExportButton || isMobile) && !showDesktopCultureActionsOverflow ? (
                <Button
                  size="small"
                  variant="outlined"
                  aria-label="Import/Export öffnen"
                  aria-controls={cultureActionsMenuAnchor ? 'culture-actions-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={Boolean(cultureActionsMenuAnchor)}
                  onClick={handleCultureActionsMenuOpen}
                  endIcon={!isPhone ? <KeyboardArrowDownIcon fontSize="small" /> : undefined}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: isPhone ? 36 : 'auto', px: isPhone ? 0.75 : 1.25, flexShrink: 0 }}
                >
                  {isPhone ? '⋯' : 'Import/Export'}
                </Button>
              ) : null}
              {showDesktopCultureActionsOverflow ? (
                <Button
                  size="small"
                  variant="outlined"
                  aria-label="Kultur-Aktionen öffnen"
                  aria-controls={cultureActionsMenuAnchor ? 'culture-actions-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={Boolean(cultureActionsMenuAnchor)}
                  onClick={handleCultureActionsMenuOpen}
                  endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 0, px: 1, flexShrink: 0 }}
                >
                  Aktionen
                </Button>
              ) : null}
              <Menu
                id="culture-actions-menu"
                anchorEl={cultureActionsMenuAnchor}
                open={Boolean(cultureActionsMenuAnchor)}
                onClose={handleCultureActionsMenuClose}
              >
                {showDesktopCultureActionsOverflow && cultureLibraryAction ? (
                  <MenuItem
                    aria-label={cultureLibraryAction.ariaLabel ?? cultureLibraryAction.label}
                    onClick={() => {
                      cultureLibraryAction.onClick();
                      handleCultureActionsMenuClose();
                    }}
                    disabled={cultureLibraryAction.disabled}
                  >
                    <ListItemText primary={cultureLibraryAction.label} />
                  </MenuItem>
                ) : null}
                {cultureImportExportActions.map((action) => (
                  <MenuItem
                    key={action.id}
                    aria-label={action.ariaLabel ?? action.label}
                    onClick={() => {
                      action.onClick();
                      handleCultureActionsMenuClose();
                    }}
                    disabled={action.disabled}
                  >
                    <ListItemText primary={action.label} secondary={action.shortcutHint} />
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : null}
          {(() => {
            const groups: TopbarContextAction[][] = [];
            [...topbarModeControls, ...topbarOverflowActions].forEach((action) => {
              const lastGroup = groups[groups.length - 1];
              if (!lastGroup || !action.groupId || lastGroup[0]?.groupId !== action.groupId) {
                groups.push([action]);
                return;
              }
              lastGroup.push(action);
            });
            return groups.map((group, index) => {
              const isSegmentedGroup = group.length > 1 && group[0]?.groupId;
              const content = group.map((action) => {
                const button = (
                <Button
                  key={action.id}
                  size="small"
                  variant={action.active ? 'contained' : 'outlined'}
                  color={action.active ? 'success' : 'inherit'}
                  onClick={action.onClick}
                  aria-label={action.ariaLabel ?? action.label}
                  aria-pressed={action.active}
                  disabled={action.disabled}
                  sx={getSegmentedActionButtonSx({
                    active: Boolean(action.active),
                    hidden: Boolean(action.hidden),
                  })}
                  style={isMobile ? { minWidth: 0, paddingLeft: 8, paddingRight: 8, fontSize: '0.74rem' } : undefined}
                >
                  {action.label}
                </Button>
                );
                return action.tooltip ? (
                  <Tooltip key={action.id} title={action.tooltip}>
                    <Box component="span" sx={{ display: 'inline-flex', minWidth: 0 }}>{button}</Box>
                  </Tooltip>
                ) : React.cloneElement(button, { key: action.id });
              });
              return isSegmentedGroup ? (
                <ButtonGroup
                  key={`group-${group[0]?.groupId}-${index}`}
                  size="small"
                  variant="outlined"
                  sx={{ ...segmentedButtonGroupSx, flexShrink: 0, minWidth: 0 }}
                >
                  {content}
                </ButtonGroup>
              ) : (
                <Box key={`group-${index}`} sx={{ display: 'inline-flex', flexShrink: 1, minWidth: 0 }}>{content}</Box>
              );
            });
          })()}
          {topbarPrimaryAction ? (
            <Tooltip title={topbarPrimaryAction.label}>
              <Button
                size="small"
                variant="contained"
                onClick={handleTopbarPrimaryAction}
                aria-label={topbarPrimaryAction.label}
                startIcon={!isPhone ? <AddIcon fontSize="small" /> : undefined}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: isPhone ? 36 : 'auto', px: isPhone ? 0.75 : 1.25, flexShrink: 0 }}
              >
                {isPhone ? <AddIcon fontSize="small" /> : topbarPrimaryAction.label}
              </Button>
            </Tooltip>
          ) : null}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, flexShrink: 0 }}>
          <Button
            aria-label={t('projectSwitcher.ariaLabel')}
            aria-controls={projectMenuAnchor ? 'project-switcher-menu' : undefined}
            aria-haspopup="true"
            onClick={handleProjectMenuOpen}
            size="small"
            disabled={isSwitchingProject}
            sx={{
              color: 'text.primary',
              textTransform: 'none',
              maxWidth: { xs: 210, sm: 190, md: 240, lg: 320 },
              minWidth: 0,
            }}
            startIcon={<FolderOpenOutlinedIcon fontSize="small" />}
            endIcon={!isPhone ? <KeyboardArrowDownIcon fontSize="small" /> : undefined}
          >
            <span className="project-switcher-label">{activeProjectLabel}</span>
          </Button>
          <ProjectMenu
            anchorEl={projectMenuAnchor}
            open={Boolean(projectMenuAnchor)}
            memberships={memberships}
            activeProjectId={activeProjectId}
            isSwitchingProject={isSwitchingProject}
            onClose={handleProjectMenuClose}
            onSwitchProject={handleSwitchProject}
            onOpenProjectSettings={handleOpenProjectSettings}
            onOpenCreateProject={handleOpenCreateProject}
            t={t}
          />
          <IconButton
            aria-label="Mehr"
            aria-controls={globalMenuAnchor ? 'global-actions-menu' : undefined}
            aria-haspopup="true"
            onClick={handleGlobalMenuOpen}
            size="small"
            sx={{ color: 'text.primary' }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <GlobalMenu
            anchorEl={globalMenuAnchor}
            open={Boolean(globalMenuAnchor)}
            historyLoading={historyLoading}
            userLabel={user?.email ? `(${user.email})` : (user?.display_label ? `(${user.display_label})` : '')}
            isMobile={false}
            onClose={handleGlobalMenuClose}
            onOpenProjectSwitcher={handleOpenMobileProjectSwitcher}
            onOpenCreateProject={handleOpenCreateProject}
            onOpenProjectSettings={handleOpenProjectSettings}
            onOpenProjectMembers={handleOpenProjectSettings}
            onOpenProjectHistory={handleOpenProjectHistory}
            onOpenAccountSettings={() => navigateFromGlobalMenu('/app/account-settings')}
            onOpenShortcuts={handleOpenShortcuts}
            onOpenHelp={openGlobalHelp}
            onLogout={handleLogout}
            t={t}
          />
            </Box>
          </Box>
          ) : (
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {topbarPrimaryAction ? (
                <Tooltip title={topbarPrimaryAction.label}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleTopbarPrimaryAction}
                    aria-label={topbarPrimaryAction.label}
                    sx={{ textTransform: 'none', minWidth: 32, px: 0.75, minHeight: 30 }}
                  >
                    <AddIcon fontSize="small" />
                  </Button>
                </Tooltip>
              ) : null}
              <IconButton
                aria-label="Mehr"
                aria-controls={globalMenuAnchor ? 'global-actions-menu' : undefined}
                aria-haspopup="true"
                onClick={handleGlobalMenuOpen}
                size="small"
                sx={{ color: 'text.primary' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <GlobalMenu
                anchorEl={globalMenuAnchor}
                open={Boolean(globalMenuAnchor)}
                historyLoading={historyLoading}
                userLabel={user?.email ? `(${user.email})` : (user?.display_label ? `(${user.display_label})` : '')}
                isMobile={isCompactTopbar}
                onClose={handleGlobalMenuClose}
                onOpenProjectSwitcher={handleOpenMobileProjectSwitcher}
                onOpenCreateProject={handleOpenCreateProject}
                onOpenProjectSettings={handleOpenProjectSettings}
                onOpenProjectMembers={handleOpenProjectSettings}
                onOpenProjectHistory={handleOpenProjectHistory}
                onOpenAccountSettings={() => navigateFromGlobalMenu('/app/account-settings')}
                onOpenShortcuts={handleOpenShortcuts}
                onOpenHelp={openGlobalHelp}
                onLogout={handleLogout}
                t={t}
              />
            </Box>
          )}
        </Toolbar>
        {isCompactTopbar && hasMobileSecondaryRow ? (
          <Box className="mobile-action-scroll" sx={{ px: 0, pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 36, flexWrap: 'wrap', whiteSpace: 'normal', width: '100%' }}>
              {isCulturesPage ? (
                <>
                  {cultureLibraryAction ? (
                    <Tooltip title="Kulturbibliothek öffnen">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => cultureLibraryAction.onClick()}
                          aria-label="Kulturbibliothek öffnen"
                          startIcon={<PublicIcon fontSize="small" />}
                          sx={{ textTransform: 'none', whiteSpace: 'nowrap', px: 1, minHeight: 30 }}
                          disabled={cultureLibraryAction.disabled}
                        >
                          Bibliothek
                        </Button>
                      </span>
                    </Tooltip>
                  ) : null}
                  {showCultureImportExportButton || isMobile ? (
                    <Button
                      size="small"
                      variant="outlined"
                      aria-label="Import/Export öffnen"
                      aria-controls={cultureActionsMenuAnchor ? 'culture-actions-menu' : undefined}
                      aria-haspopup="true"
                      aria-expanded={Boolean(cultureActionsMenuAnchor)}
                      onClick={handleCultureActionsMenuOpen}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap', px: 1, minHeight: 30 }}
                    >
                      Import/Export
                    </Button>
                  ) : null}
                  <Menu
                    id="culture-actions-menu-mobile"
                    anchorEl={cultureActionsMenuAnchor}
                    open={Boolean(cultureActionsMenuAnchor)}
                    onClose={handleCultureActionsMenuClose}
                  >
                    {cultureImportExportActions.map((action) => (
                      <MenuItem
                        key={`mobile-${action.id}`}
                        aria-label={action.ariaLabel ?? action.label}
                        onClick={() => {
                          action.onClick();
                          handleCultureActionsMenuClose();
                        }}
                        disabled={action.disabled}
                      >
                        <ListItemText primary={action.label} secondary={action.shortcutHint} />
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              ) : null}
              {(() => {
                const groups: TopbarContextAction[][] = [];
                [...topbarModeControls, ...topbarOverflowActions].forEach((action) => {
                  const lastGroup = groups[groups.length - 1];
                  if (!lastGroup || !action.groupId || lastGroup[0]?.groupId !== action.groupId) {
                    groups.push([action]);
                    return;
                  }
                  lastGroup.push(action);
                });
                const visibleGroups = isVeryNarrowMobile ? groups.slice(0, 2) : groups;
                const overflowGroups = isVeryNarrowMobile ? groups.slice(2) : [];
                const visibleNodes = visibleGroups.map((group, index) => {
                  const isSegmentedGroup = group.length > 1 && group[0]?.groupId;
                  const content = group.map((action) => (
                    <Button
                      key={action.id}
                      size="small"
                      variant={action.active ? 'contained' : 'outlined'}
                      color={action.active ? 'success' : 'inherit'}
                      onClick={action.onClick}
                      aria-label={action.ariaLabel ?? action.label}
                      aria-pressed={action.active}
                      disabled={action.disabled}
                      sx={{ ...getSegmentedActionButtonSx({ active: Boolean(action.active), hidden: Boolean(action.hidden) }), minHeight: 30, px: 1 }}
                    >
                      {action.label}
                    </Button>
                  ));
                  return isSegmentedGroup ? (
                    <ButtonGroup key={`mobile-group-${group[0]?.groupId}-${index}`} size="small" variant="outlined" sx={{ ...segmentedButtonGroupSx, flexShrink: 0 }}>
                      {content}
                    </ButtonGroup>
                  ) : (
                    <Box key={`mobile-group-${index}`} sx={{ display: 'inline-flex', flexShrink: 0 }}>{content}</Box>
                  );
                });
                if (overflowGroups.length === 0) {
                  return visibleNodes;
                }
                return [
                  ...visibleNodes,
                  <IconButton
                    key="mobile-actions-overflow-trigger"
                    size="small"
                    aria-label="Weitere Aktionen"
                    aria-controls={mobileActionsOverflowAnchor ? 'mobile-actions-overflow-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={Boolean(mobileActionsOverflowAnchor)}
                    onClick={handleMobileActionsOverflowOpen}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>,
                  <Menu
                    key="mobile-actions-overflow-menu"
                    id="mobile-actions-overflow-menu"
                    anchorEl={mobileActionsOverflowAnchor}
                    open={Boolean(mobileActionsOverflowAnchor)}
                    onClose={handleMobileActionsOverflowClose}
                  >
                    {overflowGroups.flatMap((group, groupIndex) =>
                      group.map((action) => (
                        <MenuItem
                          key={`mobile-overflow-action-${groupIndex}-${action.id}`}
                          onClick={() => {
                            action.onClick();
                            handleMobileActionsOverflowClose();
                          }}
                          disabled={action.disabled}
                        >
                          {action.label}
                        </MenuItem>
                      ))
                    )}
                  </Menu>,
                ];
              })()}
            </Box>
          </Box>
        ) : null}
      </AppBar>

      <Drawer anchor="left" open={mobileNavOpen} onClose={closeMobileNav} PaperProps={{ sx: { bgcolor: '#f5f2eb', borderRight: '1px solid #e1dbd0' } }}>
        <List sx={{ width: 280 }}>
          <ListItem sx={{ py: 1.5, px: 2 }}>
            <AppLogo size={26} showText to="/app/dashboard" />
          </ListItem>
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || item.activeAliases.includes(location.pathname);
            return (
              <ListItem key={item.to} disablePadding>
                <ListItemButton
                  onClick={() => {
                    navigate(item.to);
                    closeMobileNav();
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    borderRadius: 0,
                    px: 2,
                    py: 1.5,
                    color: '#29332c',
                    bgcolor: isActive ? 'rgba(80, 130, 90, 0.14)' : 'transparent',
                    transition: 'background-color 140ms ease, color 140ms ease',
                    '&:hover': {
                      bgcolor: isActive ? 'rgba(80, 130, 90, 0.18)' : 'rgba(91, 130, 102, 0.08)',
                      color: '#29332c',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: '#2c4f33', transition: 'color 140ms ease' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: isActive ? 600 : 500 }} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          width: '100%',
          // Global outer page gutter (single source of truth for workspace pages).
          // Uses smaller desktop gutters on wide monitors while keeping clear edge spacing.
          px: { xs: 0, sm: 2, md: 2.5, lg: 2.25, xl: 2 },
          py: { xs: 1.5, md: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0,
        }}
      >
        {memberships.length === 0 ? (
          <Button
            variant="contained"
            onClick={handleOpenCreateProject}
            sx={{ alignSelf: 'flex-start', mx: { xs: 1.5, sm: 0 } }}
          >
            {t('common:projectRequired.createFirstProjectAction')}
          </Button>
        ) : null}
        <Outlet context={{ setTopbarContextActions } satisfies RootLayoutOutletContext} />
      </Box>
      </Box>

      <Dialog open={projectHistoryOpen} onClose={() => setProjectHistoryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('commandPalette.commands.openVersionHistory')}</DialogTitle>
        <DialogContent sx={{ py: isPhonePortrait ? 1 : 2 }}>
          <List>
            {historyItems.map((item, index) => {
              const isCurrentVersion = index === 0;
              const historyTarget = getHistoryEntryTarget(item);
              const title = getHistoryEntryTitle(item, tCultures);
              const actorLabel = item.actor_label?.trim()
                || item.history_user?.trim()
                || fallbackHistoryActorLabel?.trim()
                || 'Unbekannter Benutzer';
              const timestampLabel = formatHistoryTimestamp(item.history_date);

              return (
                <ListItem key={item.history_id} disableGutters sx={{ mb: isPhonePortrait ? 1 : 0 }}>
                  {isPhonePortrait ? (
                    <Paper variant="outlined" sx={{ width: '100%', p: 1.25, borderRadius: 1.5 }}>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          {isCurrentVersion
                            ? <Chip label="Aktuell" size="small" color="success" variant="outlined" />
                            : <Chip label="Version" size="small" variant="outlined" />}
                          {historyTarget ? (
                            <Link
                              component={RouterLink}
                              to={historyTarget}
                              underline="hover"
                              onClick={() => setProjectHistoryOpen(false)}
                              sx={{ fontSize: '0.78rem', color: 'text.secondary', flexShrink: 0 }}
                            >
                              {item.object_type === 'culture' ? t('navigation:cultures') : t('navigation:plantingPlans')}
                            </Link>
                          ) : null}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                          }}
                        >
                          {title}
                        </Typography>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                          <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Von {actorLabel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            · {timestampLabel}
                          </Typography>
                        </Box>
                        {isCurrentVersion && item.action === 'restored' ? (
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                            Originalversion vom {formatHistoryTimestamp(item.history_date)}
                          </Typography>
                        ) : null}
                        {!isCurrentVersion ? (
                          <>
                            <Divider />
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => setPendingRestoreEntry(item)}
                              sx={{ alignSelf: 'flex-start', minHeight: 34 }}
                            >
                              Version wiederherstellen
                            </Button>
                          </>
                        ) : null}
                      </Stack>
                    </Paper>
                  ) : (
                    <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
                      <ListItemText
                        sx={{ mr: 1 }}
                        primary={(
                          <>
                            {title}
                            {historyTarget ? (
                              <>
                                {' · '}
                                <Link
                                  component={RouterLink}
                                  to={historyTarget}
                                  underline="hover"
                                  onClick={() => setProjectHistoryOpen(false)}
                                >
                                  {item.object_type === 'culture' ? t('navigation:cultures') : t('navigation:plantingPlans')}
                                </Link>
                              </>
                            ) : null}
                          </>
                        )}
                        secondary={(
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                            <PersonOutlineIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                            <Typography component="span" variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                              Von {actorLabel}
                            </Typography>
                            <Typography component="span" variant="caption" color="text.secondary">
                              · {timestampLabel}
                            </Typography>
                          </Box>
                        )}
                      />
                      {isCurrentVersion
                        ? <Chip label={t('commandPalette.currentVersion')} size="small" color="success" variant="outlined" />
                        : <Button onClick={() => setPendingRestoreEntry(item)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Version wiederherstellen</Button>}
                    </Stack>
                  )}
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectHistoryOpen(false)}>{t('common:actions.close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('commandPalette.shortcutsTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Navigation</Typography>
            <List dense disablePadding>
              <ListItem><ListItemText primary={t('commandPalette.commands.nextPage')} secondary="Ctrl+Shift+↓" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.previousPage')} secondary="Ctrl+Shift+↑" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.openVersionHistory')} secondary="Alt+V" /></ListItem>
            </List>
            <Typography variant="subtitle2">Ansichten & Layout</Typography>
            <List dense disablePadding>
              <ListItem><ListItemText primary="Sidebar ein-/ausklappen" secondary="Ctrl+B" /></ListItem>
            </List>
            <Typography variant="subtitle2">Dialoge & Hilfe</Typography>
            <List dense disablePadding>
              <ListItem><ListItemText primary="Seitenhilfe öffnen" secondary="Alt+H" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.label')} secondary="Alt+K" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.closeDialog')} secondary="Esc" /></ListItem>
            </List>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShortcutsOpen(false)}>{t('common:actions.close')}</Button>
        </DialogActions>
      </Dialog>
      <HelpDialog open={globalHelpOpen} onClose={closeGlobalHelp} />
      <Dialog open={mobileProjectSwitcherOpen} onClose={handleCloseMobileProjectSwitcher} fullWidth maxWidth="sm">
        <DialogTitle>{t('projectSwitcher.ariaLabel')}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ display: 'block', mb: 1.25, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Aktives Projekt
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.25, mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckIcon fontSize="small" color="success" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{activeProjectLabel}</Typography>
            </Stack>
          </Paper>
          <Typography variant="caption" sx={{ display: 'block', mb: 1.25, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Projekte
          </Typography>
          <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, py: 0 }}>
            {memberships.length === 0 ? (
              <ListItem><ListItemText primary={t('projectSwitcher.zeroProjects')} /></ListItem>
            ) : memberships.map((membership) => (
              <ListItemButton
                key={`switcher-${membership.project_id}`}
                onClick={() => void handleSwitchProject(membership.project_id)}
                selected={membership.project_id === activeProjectId}
                disabled={isSwitchingProject}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {membership.project_id === activeProjectId ? <CheckIcon fontSize="small" color="success" /> : null}
                </ListItemIcon>
                <ListItemText primary={membership.project_name} />
              </ListItemButton>
            ))}
          </List>
          <Button
            startIcon={<AddIcon fontSize="small" />}
            variant="outlined"
            onClick={handleOpenCreateProject}
            sx={{ mt: 2, textTransform: 'none' }}
          >
            {t('project.create')}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingRestoreEntry)} onClose={() => setPendingRestoreEntry(null)} fullWidth maxWidth="xs">
        <DialogTitle>Version wiederherstellen?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Du stellst eine frühere Version wieder her.
          </Typography>
          {pendingRestoreEntry ? (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {pendingRestoreEntry.object_display_name?.trim() || getHistoryEntryTitle(pendingRestoreEntry, tCultures)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Bearbeitet am {formatHistoryTimestamp(pendingRestoreEntry.history_date)}
              </Typography>
            </Box>
          ) : null}
          <Box
            sx={{
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'success.light',
              bgcolor: 'rgba(76, 175, 80, 0.08)',
              px: 1.25,
              py: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Die aktuelle Version bleibt erhalten. Vor der Wiederherstellung wird automatisch eine neue Version erstellt, sodass du jederzeit wieder zurückwechseln kannst.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            Es gehen keine Daten verloren.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRestoreEntry(null)}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (pendingRestoreEntry) {
                void handleRestoreProjectVersion(pendingRestoreEntry.history_id);
              }
            }}
          >
            Version wiederherstellen
          </Button>
        </DialogActions>
      </Dialog>


      <Dialog open={isCreateProjectOpen} onClose={closeCreateProjectDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('projectSwitcher.createDialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('projectSwitcher.createNameLabel')}
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              autoFocus
            />
            <TextField
              label={t('projectSwitcher.createDescriptionLabel')}
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateProjectDialog}>{t('projectSwitcher.createCancel')}</Button>
          <Button variant="contained" onClick={() => void handleCreateProject()} disabled={!newProjectName.trim() || isCreatingProject}>
            {t('projectSwitcher.createSubmit')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function LegacyInvitationRedirect(): React.ReactElement {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');
  if (!token) {
    return <Navigate to="/invite/invalid" replace />;
  }
  return <Navigate to={buildInvitationAcceptPath(token)} replace />;
}

function TokenInvitationRedirect(): React.ReactElement {
  const location = useLocation();
  const token = location.pathname.split('/').pop();
  if (!token) {
    return <Navigate to="/invite/invalid" replace />;
  }
  return <Navigate to={buildInvitationAcceptPath(token)} replace />;
}

function withLazyFallback(element: React.ReactElement): React.ReactElement {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function createAppRouter(basename: string) {
  return createBrowserRouter([
    {
      path: '/',
      element: withLazyFallback(<HomePage />),
    },
    {
      path: '/impressum',
      element: withLazyFallback(<ImprintPage />),
    },
    {
      path: '/datenschutz',
      element: withLazyFallback(<PrivacyPolicyPage />),
    },
    {
      path: '/login',
      element: withLazyFallback(<LoginPage />),
    },
    {
      path: '/register',
      element: withLazyFallback(<RegisterPage />),
    },
    {
      path: '/activate',
      element: withLazyFallback(<ActivatePage />),
    },
    {
      path: '/forgot-password',
      element: withLazyFallback(<ForgotPasswordPage />),
    },
    {
      path: '/reset-password',
      element: withLazyFallback(<ResetPasswordPage />),
    },
    {
      path: '/confirm-email-change',
      element: withLazyFallback(<ConfirmEmailChangePage />),
    },
    {
      path: '/invitation',
      element: <LegacyInvitationRedirect />,
    },
    {
      path: '/invite/accept',
      element: withLazyFallback(<InvitationAcceptPage />),
    },
    {
      path: '/invite/:token',
      element: <TokenInvitationRedirect />,
    },
    {
      path: '/app',
      element: <ProtectedRoute />,
      children: [
        {
          path: '',
          element: <RootLayout />,
          children: [
            {
              index: true,
              loader: () => redirect('/app/dashboard'),
            },
            { path: 'dashboard', element: withLazyFallback(<Dashboard />) },
            { path: 'locations', element: withLazyFallback(<Locations />) },
            { path: 'fields-beds', element: withLazyFallback(<FieldsBedsPage />) },
            { path: 'cultures', element: withLazyFallback(<Cultures />) },
            { path: 'anbauplaene', element: withLazyFallback(<PlantingPlans />) },
            { path: 'suppliers', element: withLazyFallback(<Suppliers />) },
            { path: 'planting-plans', element: withLazyFallback(<PlantingPlans />) },
            { path: 'gantt-chart', element: withLazyFallback(<GanttChart />) },
            { path: 'seed-demand', element: withLazyFallback(<SeedDemandPage />) },
            { path: 'project-selection', element: withLazyFallback(<ProjectSelectionPage />) },
            { path: 'account-settings', element: withLazyFallback(<AccountSettingsPage />) },
            { path: 'project-settings', element: withLazyFallback(<ProjectSettingsPage />) },
          ],
        },
      ],
    },
  ], {
    basename,
  });
}

function App(): React.ReactElement {
  // Use Vite's base URL when URL is inside that subdirectory, otherwise fall back to root.
  const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const currentPath = window.location.pathname;
  const basename = resolveRouterBasename(configuredBase, currentPath);

  const router = createAppRouter(basename);

  return <RouterProvider router={router} />;
}

export default App;
