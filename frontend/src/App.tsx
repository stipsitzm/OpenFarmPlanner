/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, RouterProvider, Outlet, Link as RouterLink, redirect, useLocation, useNavigate, Navigate, useRouteError } from 'react-router-dom';
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
  SvgIcon,
  type SvgIconProps,
  TextField,
  Drawer,
  ListItemButton,
  ListItemIcon,
  Toolbar,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
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
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import LocalFloristOutlinedIcon from '@mui/icons-material/LocalFloristOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PublicIcon from '@mui/icons-material/Public';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
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
import { getHistoryEntryTarget, getHistoryEntryTitle, isCurrentHistoryEntry } from './pages/culturesHistoryUtils';
import { resolveRouterBasename } from './routerBasename';
import { OPEN_CREATE_PROJECT_EVENT } from './projects/projectCreationFlow';
import { useGlobalOverlayKeyboardScroll } from './hooks/useDialogKeyboardScroll';
import { KEYBOARD_NAV_ROUTES, MAIN_NAV_ITEMS, getKeyboardNavigationRouteFromPathname, normalizeMainRoutePath } from './navigation/mainNavigation';
import {
  getMobileNavigationIconSx,
  getMobileNavigationItemSx,
  getNavigationIconSx,
  getNavigationItemSx,
  getNavigationShellSx,
  getNavigationTextProps,
  getNavigationToggleButtonSx,
  getMobileNavigationTextProps,
  mobileNavigationDrawerPaperSx,
  navigationLogoLinkSx,
  navigationLogoTextSx,
  navigationTooltipSx,
} from './navigation/navigationStyles';
import { PanelLeft } from 'lucide-react';
import RuntimeErrorState from './components/runtime/RuntimeErrorState';
import {
  isDynamicImportLoadError,
  reloadOnceForDynamicImportError,
  reloadPage,
  shouldAutomaticallyReloadForRouteLoadError,
} from './runtime/chunkLoadErrors';

const CONTENT_ALIGNMENT_MODE = 'centered';
const ACTION_MENU_ITEM_ICON_SX = { minWidth: 32, color: 'text.secondary' } as const;
const ACTION_MENU_ICON_PROPS = { fontSize: 'small' } as const;
const HIERARCHY_CREATE_LOCATION_ACTION_ID = 'fields-global-add-location';
const TOPBAR_ACTION_GROUP_GAP = 1.25;
const COMPACT_TOPBAR_TOGGLE_SIZE = 44;

function FileExportIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 -960 960 960">
      <path d="M480-480ZM202-65l-56-57 118-118h-90v-80h226v226h-80v-89L202-65Zm278-15v-80h240v-440H520v-200H240v400h-80v-400q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H480Z" />
    </SvgIcon>
  );
}

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
const YieldOverviewPage = React.lazy(() => import('./pages/YieldOverview'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

interface GlobalSnackbarEventDetail {
  message: string;
  severity: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
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

function ProjectMenu(props: ProjectMenuProps) {
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
  onOpenProjectHistory: () => Promise<void>;
  onOpenAccountSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenHelp: () => void;
  onLogout: () => Promise<void>;
  t: (key: string) => string;
}

function GlobalMenu(props: GlobalMenuProps) {
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
    onOpenProjectHistory,
    onOpenAccountSettings,
    onOpenShortcuts,
    onOpenHelp,
    onLogout,
    t,
  } = props;

  const wrap = (fn: () => void): () => void => () => { onClose(); fn(); };
  const wrapAsync = (fn: () => Promise<void>): () => void => () => { onClose(); void fn(); };

  const mobileMenuItems = [
    <MenuItem key="mobile-section-project" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('globalMenu.projectActions')}</MenuItem>,
    <MenuItem key="mobile-project-switcher" onClick={wrap(onOpenProjectSwitcher)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SwapHorizIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('projectSwitcher.ariaLabel')}</MenuItem>,
    <MenuItem key="mobile-project-create" onClick={wrap(onOpenCreateProject)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><AddIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.create')}</MenuItem>,
    <MenuItem key="mobile-project-settings" onClick={wrap(onOpenProjectSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.settings')}</MenuItem>,
    <MenuItem key="mobile-project-history" onClick={wrapAsync(onOpenProjectHistory)} disabled={historyLoading}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HistoryOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.openVersionHistory')}</MenuItem>,
    <Divider key="mobile-divider-project-app" />,
    <MenuItem key="mobile-section-app" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('globalMenu.app')}</MenuItem>,
    <MenuItem key="mobile-app-shortcuts" onClick={wrap(onOpenShortcuts)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><KeyboardOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.shortcuts')}</MenuItem>,
    <MenuItem key="mobile-app-help" onClick={wrap(onOpenHelp)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HelpOutlineIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.appHelp')}</MenuItem>,
    <MenuItem key="mobile-app-account-settings" onClick={wrap(onOpenAccountSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('accountSettings')}</MenuItem>,
    <Divider key="mobile-divider-app-account" />,
    <MenuItem key="mobile-section-account" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('globalMenu.account')}</MenuItem>,
    <MenuItem key="mobile-account-logout" onClick={wrapAsync(onLogout)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><LogoutIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.logout')} {userLabel}</MenuItem>,
  ];
  const desktopMenuItems = [
    <MenuItem key="desktop-project-settings" onClick={wrap(onOpenProjectSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.settings')}</MenuItem>,
    <MenuItem key="desktop-history" onClick={wrapAsync(onOpenProjectHistory)} disabled={historyLoading}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HistoryOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.openVersionHistory')}</MenuItem>,
    <Divider key="desktop-divider" />,
    <MenuItem key="desktop-account-settings" onClick={wrap(onOpenAccountSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('accountSettings')}</MenuItem>,
    <MenuItem key="desktop-shortcuts" onClick={wrap(onOpenShortcuts)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><KeyboardOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.shortcuts')}</MenuItem>,
    <MenuItem key="desktop-help" onClick={wrap(onOpenHelp)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HelpOutlineIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.appHelp')}</MenuItem>,
    <MenuItem key="desktop-logout" onClick={wrapAsync(onLogout)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><LogoutIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.logout')} {userLabel}</MenuItem>,
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
  menuActions?: Array<{ id: string; label: string; onClick: () => void; disabled?: boolean }>;
}

export interface RootLayoutOutletContext {
  setTopbarContextActions: (actions: TopbarContextAction[]) => void;
  setTopbarTitleActions: (actions: TopbarContextAction[]) => void;
}

function getCompactTopbarActionIcon(actionId: string): React.ReactNode {
  switch (actionId) {
    case 'fields-view-mode-list':
      return <ViewListOutlinedIcon fontSize="small" />;
    case 'fields-view-mode-graphical':
      return <MapOutlinedIcon fontSize="small" />;
    case 'calendar-view-mode-occupancy':
      return <EventNoteOutlinedIcon fontSize="small" />;
    case 'calendar-view-mode-seedlings':
      return <LocalFloristOutlinedIcon fontSize="small" />;
    default:
      return null;
  }
}


/**
 * Root layout component with navigation.
 * Wraps all routes with the persistent navigation bar.
 */
function RootLayout() {
  const { t, i18n } = useTranslation('navigation');
  useGlobalOverlayKeyboardScroll();
  const tCultures = useMemo(
    () => i18n.getFixedT(i18n.resolvedLanguage ?? i18n.language ?? 'de', 'cultures'),
    [i18n],
  );
  const tCommon = useMemo(
    () => i18n.getFixedT(i18n.resolvedLanguage ?? i18n.language ?? 'de', 'common'),
    [i18n],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const currentPathnameRef = React.useRef(location.pathname);
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
  const { activeCreateActions, openPalette, runPrimaryCreateAction } = useCommandContext();
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<null | HTMLElement>(null);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileProjectSwitcherOpen, setMobileProjectSwitcherOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!isLargeDesktop);
  const [isSwitchingProject, setIsSwitchingProject] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [topbarContextActions, setTopbarContextActions] = useState<TopbarContextAction[]>([]);
  const [topbarTitleActions, setTopbarTitleActions] = useState<TopbarContextAction[]>([]);
  const [cultureActionsMenuAnchor, setCultureActionsMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileActionsOverflowAnchor, setMobileActionsOverflowAnchor] = useState<null | HTMLElement>(null);
  const [topbarPrimaryActionMenuAnchor, setTopbarPrimaryActionMenuAnchor] = useState<null | HTMLElement>(null);
  currentPathnameRef.current = location.pathname;

  useEffect(() => {
    setTopbarContextActions([]);
    setTopbarTitleActions([]);
  }, [location.pathname]);

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
                : item.to.includes('yield-overview') ? <BarChartOutlinedIcon fontSize="small" />
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

  const handleCollapsedSidebarBackgroundClick = (event: React.MouseEvent<HTMLElement>): void => {
    if (!sidebarCollapsed) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest('a, button, input, textarea, select, [role="button"], [role="link"], [tabindex]')) {
      return;
    }
    setSidebarCollapsed(false);
    window.localStorage.setItem('openfarmplanner.sidebarCollapsed', 'false');
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
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error', actionLabel?: string, onAction?: () => void) => {
    setSnackbar({ open: true, message, severity, actionLabel, onAction });
  }, []);

  useEffect(() => {
    const handleGlobalSnackbar = (event: Event): void => {
      const detail = (event as CustomEvent<GlobalSnackbarEventDetail>).detail;
      if (!detail?.message) {
        return;
      }
      showSnackbar(detail.message, detail.severity ?? 'success', detail.actionLabel, detail.onAction);
    };

    window.addEventListener('ofp:show-snackbar', handleGlobalSnackbar);
    return () => window.removeEventListener('ofp:show-snackbar', handleGlobalSnackbar);
  }, [showSnackbar]);

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
  const isFieldsBedsPage = location.pathname.startsWith('/app/fields-beds');
  const isCalendarPage = location.pathname.startsWith('/app/gantt-chart');
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
  const mobileTopbarViewActions = useMemo(
    () => topbarModeControls.filter((action) => !action.hidden),
    [topbarModeControls],
  );
  const mobileFieldsAddLocationAction = useMemo(
    () => topbarOverflowActions.find((action) => action.id === HIERARCHY_CREATE_LOCATION_ACTION_ID && !action.hidden) ?? null,
    [topbarOverflowActions],
  );
  const activeMobileTopbarViewActionId = mobileTopbarViewActions.find((action) => action.active)?.id ?? null;
  const showMobileTopbarViewActions = isCompactTopbar
    && (isFieldsBedsPage || isCalendarPage)
    && (mobileTopbarViewActions.length > 0 || (isFieldsBedsPage && Boolean(mobileFieldsAddLocationAction)));
  const hasVisibleMobileContextActions = useMemo(
    () => [...topbarModeControls, ...topbarOverflowActions].some((action) => !action.hidden),
    [topbarModeControls, topbarOverflowActions],
  );
  const hasMobileSecondaryRow = useMemo(
    () => (
      !isFieldsBedsPage
      && !isCalendarPage
      && !isCulturesPage
      && (
        hasVisibleMobileContextActions
      )
    ),
    [hasVisibleMobileContextActions, isCalendarPage, isCulturesPage, isFieldsBedsPage],
  );
  const handleCreateProject = async (): Promise<void> => {
    if (!newProjectName.trim()) {
      return;
    }
    setIsCreatingProject(true);
    try {
      const response = await projectAPI.create({
        name: newProjectName.trim(),
        description: '',
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

  const handleCreateProjectSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!newProjectName.trim() || isCreatingProject) {
      return;
    }
    void handleCreateProject();
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

  const getCurrentRouteFromLocation = useCallback((): string => {
    const pathname = currentPathnameRef.current;
    return getKeyboardNavigationRouteFromPathname(pathname) ?? normalizeMainRoutePath(pathname);
  }, []);

  const navigateRelativePage = useCallback((direction: 1 | -1): void => {
    const currentRoute = getCurrentRouteFromLocation();
    const currentIndex = KEYBOARD_NAV_ROUTES.indexOf(currentRoute);

    if (currentIndex === -1) {
      console.warn(`[keyboard-nav] Unknown route "${currentRoute}" (pathname: "${currentPathnameRef.current}"). Falling back to dashboard.`);
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
    currentPath: getCurrentRouteFromLocation(),
    activeProjectId,
    memberships,
    onNextPage: goToNextPage,
    onPreviousPage: goToPreviousPage,
    onOpenProjectSettings: handleOpenProjectSettings,
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
      createProject: t('commandPalette.commands.createProject'),
      switchProjectPrefix: t('commandPalette.commands.switchProjectPrefix'),
      openAccountSettings: t('commandPalette.commands.openAccountSettings'),
      openVersionHistory: t('commandPalette.commands.openVersionHistory'),
      logout: t('commandPalette.commands.logout'),
      openPalette: t('commandPalette.label'),
      openShortcuts: t('commandPalette.commands.openShortcuts'),
    },
  }), [
    activeProjectId,
    getCurrentRouteFromLocation,
    goToNextPage,
    goToPreviousPage,
    handleLogout,
    handleOpenCreateProject,
    handleOpenProjectHistory,
    handleOpenProjectSettings,
    handleSwitchProject,
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
    if (!activeItem && location.pathname.startsWith('/app/locations')) {
      return t('locations');
    }
    return activeItem?.label ?? '';
  }, [location.pathname, navItems, t]);
  useEffect(() => {
    const appName = tCommon('appName');
    document.title = currentPageTitle ? `${currentPageTitle} – ${appName}` : appName;
    return () => {
      document.title = appName;
    };
  }, [currentPageTitle, tCommon]);
  const topbarHelpConfig = useMemo(() => {
    if (location.pathname.startsWith('/app/dashboard')) return { pageKey: 'dashboard' as const, label: t('pageHelp.dashboard') };
    if (location.pathname.startsWith('/app/locations')) return { pageKey: 'locations' as const, label: t('pageHelp.locations') };
    if (location.pathname.startsWith('/app/fields-beds')) return { pageKey: 'areas' as const, label: t('pageHelp.areas') };
    if (location.pathname.startsWith('/app/cultures')) return { pageKey: 'cultures' as const, label: t('pageHelp.cultures') };
    if (location.pathname.startsWith('/app/anbauplaene') || location.pathname.startsWith('/app/planting-plans')) return { pageKey: 'plantingPlans' as const, label: t('pageHelp.plantingPlans') };
    if (location.pathname.startsWith('/app/gantt-chart')) return { pageKey: 'calendar' as const, label: t('pageHelp.calendar') };
    if (location.pathname.startsWith('/app/yield-overview')) return { pageKey: 'yieldOverview' as const, label: t('pageHelp.yieldOverview') };
    if (location.pathname.startsWith('/app/seed-demand')) return { pageKey: 'seedDemand' as const, label: t('pageHelp.seedDemand') };
    if (location.pathname.startsWith('/app/suppliers')) return { pageKey: 'suppliers' as const, label: t('pageHelp.suppliers') };
    return null;
  }, [location.pathname, t]);
  const topbarPrimaryAction = useMemo(() => {
    if (activeCreateActions.length > 0) {
      const isSingleCreateAction = activeCreateActions.length === 1;
      const primaryCreateAction = activeCreateActions[0];
      const label = isSingleCreateAction ? primaryCreateAction.label : t('commandPalette.createNew');
      return {
        label,
        tooltip: `${label} (${primaryCreateAction.shortcut ?? 'Alt+Shift+N'})`,
        onClick: runPrimaryCreateAction,
      };
    }
    if (location.pathname.startsWith('/app/fields-beds')) return fieldsGlobalAddAction ? { label: fieldsGlobalAddAction.label, to: '', onClick: fieldsGlobalAddAction.onClick, menuActions: fieldsGlobalAddAction.menuActions } : null;
    return null;
  }, [activeCreateActions, fieldsGlobalAddAction, location.pathname, runPrimaryCreateAction, t]);
  const handleTopbarPrimaryAction = useCallback((): void => {
    if (!topbarPrimaryAction) {
      return;
    }
    if (topbarPrimaryAction.menuActions && topbarPrimaryAction.menuActions.length > 0) {
      return;
    }
    if (topbarPrimaryAction.onClick) {
      topbarPrimaryAction.onClick();
      return;
    }
    if ('to' in topbarPrimaryAction && topbarPrimaryAction.to) {
      navigate(topbarPrimaryAction.to);
    }
  }, [navigate, topbarPrimaryAction]);

  return (
    <Box className={`app app--${CONTENT_ALIGNMENT_MODE}`} sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'surface.appBackground', position: 'relative', isolation: 'isolate' }}>
      {isDesktopUp ? (
        <Box
          component="aside"
          onClick={handleCollapsedSidebarBackgroundClick}
          sx={getNavigationShellSx(sidebarWidth, sidebarCollapsed)}
        >
          <Stack sx={{ height: '100%', minHeight: 0, width: '100%' }}>
            {!sidebarCollapsed ? (
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, gap: 1 }}>
                <Box
                  component={RouterLink}
                  to="/app/dashboard"
                  aria-label={t('globalMenu.dashboardLink')}
                  title={t('globalMenu.dashboardLink')}
                  sx={navigationLogoLinkSx}
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
                    sx={navigationLogoTextSx}
                  >
                    OpenFarmPlanner
                  </Typography>
                </Box>
                <Tooltip
                  title={t('globalMenu.closeSidebar')}
                  placement="right"
                  enterDelay={350}
                  slotProps={{ tooltip: { sx: navigationTooltipSx } }}
                >
                  <IconButton
                    aria-label={t('globalMenu.collapseSidebar')}
                    onClick={toggleSidebarCollapsed}
                    size="small"
                    sx={getNavigationToggleButtonSx('w-resize')}
                  >
                    <PanelLeft size={18} strokeWidth={1.8} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Stack direction="row" alignItems="center" justifyContent="center" sx={{ py: 1, mb: 0.75 }}>
                <Tooltip
                  title={t('globalMenu.openSidebar')}
                  placement="right"
                  enterDelay={350}
                  slotProps={{ tooltip: { sx: navigationTooltipSx } }}
                >
                  <IconButton
                    aria-label={t('globalMenu.expandSidebar')}
                    onClick={toggleSidebarCollapsed}
                    size="small"
                    sx={getNavigationToggleButtonSx('e-resize')}
                  >
                    <PanelLeft size={18} strokeWidth={1.8} />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
            <List sx={{ px: 1, pt: 0.5, pb: 1, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || item.activeAliases.includes(location.pathname);
                const entry = (
                  <ListItemButton
                    key={item.to}
                    component={RouterLink as React.ElementType}
                    to={item.to}
                    selected={isActive}
                    sx={getNavigationItemSx(isActive, sidebarCollapsed)}
                  >
                    <ListItemIcon sx={getNavigationIconSx(isActive, sidebarCollapsed)}>{item.icon}</ListItemIcon>
                    {!sidebarCollapsed ? <ListItemText primary={item.label} primaryTypographyProps={getNavigationTextProps(isActive)} /> : null}
                  </ListItemButton>
                );
                return sidebarCollapsed ? <Tooltip key={item.to} title={item.label} placement="right">{entry}</Tooltip> : entry;
              })}
            </List>
          </Stack>
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', bgcolor: 'surface.contentBackground' }}>
      <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {navItems.map((item) => {
          const srLinkLabel = item.to === '/app/dashboard' ? t('globalMenu.dashboardLink') : item.label;
          return <RouterLink key={`sr-${item.to}`} to={item.to} aria-label={srLinkLabel}>{item.label}</RouterLink>;
        })}
      </Box>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'surface.surfaceBorder', bgcolor: 'surface.topbarBackground', backdropFilter: 'saturate(120%) blur(2px)' }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 56, gap: 1, py: 0.5, px: { xs: 0, sm: 2, md: 3 }, flexWrap: 'nowrap', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          {!isDesktopUp ? <IconButton aria-label={t('globalMenu.openMobileMenu')} onClick={() => setMobileNavOpen(true)}><MenuIcon /></IconButton> : null}
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0, flexShrink: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
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
                  flexShrink: 1,
                }}
              >
                {currentPageTitle}
              </Typography>
            ) : (
              <Typography component="h1" variant="h5" noWrap sx={{ minWidth: 0, maxWidth: { sm: 180, md: 260 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: { xs: '1rem', md: '1.25rem' }, fontWeight: 600 }}>
                {currentPageTitle}
              </Typography>
            )}
            {topbarHelpConfig ? <PageHelp pageKey={topbarHelpConfig.pageKey} ariaLabel={t('pageHelp.openAria', { label: topbarHelpConfig.label })} tooltip={topbarHelpConfig.label} /> : null}
            {topbarTitleActions.length > 0 ? (
              isCompactTopbar ? (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={topbarTitleActions.find((action) => action.active)?.id ?? null}
                  aria-label={isCalendarPage ? t('ganttChart:modeAriaLabel') : t('fields:representation.ariaLabel')}
                  sx={{
                    ml: 0.5,
                    flexShrink: 0,
                    '& .MuiToggleButton-root': {
                      width: COMPACT_TOPBAR_TOGGLE_SIZE,
                      height: COMPACT_TOPBAR_TOGGLE_SIZE,
                      p: 0,
                      borderColor: 'divider',
                      color: 'text.primary',
                      visibility: 'visible',
                      '&.Mui-selected': {
                        bgcolor: 'success.main',
                        color: 'success.contrastText',
                        borderColor: 'success.dark',
                        borderWidth: 2,
                        boxShadow: 1,
                      },
                      '&.Mui-selected:hover': {
                        bgcolor: 'success.dark',
                      },
                    },
                  }}
                >
                  {topbarTitleActions.map((action) => {
                    const icon = getCompactTopbarActionIcon(action.id);
                    if (!icon) {
                      return null;
                    }
                    return (
                      <Tooltip key={action.id} title={action.tooltip ?? action.label} describeChild enterTouchDelay={0}>
                        <ToggleButton
                          value={action.id}
                          aria-label={action.label}
                          onClick={action.onClick}
                          disabled={action.disabled}
                          sx={action.hidden ? {
                            visibility: 'hidden',
                            pointerEvents: 'none',
                          } : undefined}
                        >
                          {icon}
                        </ToggleButton>
                      </Tooltip>
                    );
                  })}
                </ToggleButtonGroup>
              ) : (
              <ButtonGroup
                size="small"
                variant="outlined"
                sx={{ ...segmentedButtonGroupSx, ml: 1, flexShrink: 0 }}
              >
                {topbarTitleActions.map((action) => (
                  <Button
                    key={action.id}
                    size="small"
                    variant={action.active ? 'contained' : 'outlined'}
                    color={action.active ? 'success' : 'inherit'}
                    onClick={action.onClick}
                    aria-label={action.ariaLabel ?? action.label}
                    aria-pressed={action.active}
                    disabled={action.disabled}
                    sx={getSegmentedActionButtonSx({ active: Boolean(action.active), hidden: Boolean(action.hidden) })}
                  >
                    {action.label}
                  </Button>
                ))}
              </ButtonGroup>
              )
            ) : null}
          </Box>
          {!isCompactTopbar ? (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', minWidth: 0, maxWidth: '100%', flex: 1, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: TOPBAR_ACTION_GROUP_GAP, minWidth: 0, flex: 1, justifyContent: 'flex-end', overflow: 'hidden', pr: 0.5 }}>
          {isCulturesPage ? (
            <>
              {cultureLibraryAction && !showDesktopCultureActionsOverflow ? (
                <Tooltip title={t('cultureActions.openLibrary')}>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => cultureLibraryAction.onClick()}
                      aria-label={t('cultureActions.openLibrary')}
                      startIcon={<PublicIcon fontSize="small" />}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: showIconOnlyCultureLibrary ? 36 : 'auto', px: showIconOnlyCultureLibrary ? 0.75 : 1.25, flexShrink: 0 }}
                      disabled={cultureLibraryAction.disabled}
                    >
                      {!showIconOnlyCultureLibrary ? (showCompactCultureLibrary ? t('cultureActions.libraryShort') : t('cultureActions.library')) : null}
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              {(showCultureImportExportButton || isMobile) && !showDesktopCultureActionsOverflow ? (
                <Button
                  size="small"
                  variant="outlined"
                  aria-label={t('cultureActions.openImportExport')}
                  aria-controls={cultureActionsMenuAnchor ? 'culture-actions-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={Boolean(cultureActionsMenuAnchor)}
                  onClick={handleCultureActionsMenuOpen}
                  endIcon={!isPhone ? <KeyboardArrowDownIcon fontSize="small" /> : undefined}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: isPhone ? 36 : 'auto', px: isPhone ? 0.75 : 1.25, flexShrink: 0 }}
                >
                  {isPhone ? '⋯' : t('cultureActions.importExport')}
                </Button>
              ) : null}
              {showDesktopCultureActionsOverflow ? (
                <Button
                  size="small"
                  variant="outlined"
                  aria-label={t('cultureActions.openCultureActions')}
                  aria-controls={cultureActionsMenuAnchor ? 'culture-actions-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={Boolean(cultureActionsMenuAnchor)}
                  onClick={handleCultureActionsMenuOpen}
                  endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 0, px: 1, flexShrink: 0 }}
                >
                  {t('cultureActions.actions')}
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
                const isHierarchyCreateLocationAction = action.id === HIERARCHY_CREATE_LOCATION_ACTION_ID;
                const button = (
                <Button
                  key={action.id}
                  size="small"
                  variant={isHierarchyCreateLocationAction || action.active ? 'contained' : 'outlined'}
                  color={action.active ? 'success' : isHierarchyCreateLocationAction ? 'primary' : 'inherit'}
                  onClick={action.onClick}
                  aria-label={action.ariaLabel ?? action.label}
                  aria-pressed={action.active}
                  disabled={action.disabled}
                  startIcon={isHierarchyCreateLocationAction && !isPhone ? <AddIcon fontSize="small" /> : undefined}
                  sx={isHierarchyCreateLocationAction
                    ? {
                      textTransform: 'none',
                      whiteSpace: 'nowrap',
                      minWidth: isPhone ? 36 : 'auto',
                      px: isPhone ? 0.75 : 1.25,
                      flexShrink: 0,
                      ...(action.hidden ? { display: 'none' } : {}),
                    }
                    : getSegmentedActionButtonSx({
                      active: Boolean(action.active),
                      hidden: Boolean(action.hidden),
                    })}
                  style={!isHierarchyCreateLocationAction && isMobile ? { minWidth: 0, paddingLeft: 8, paddingRight: 8, fontSize: '0.74rem' } : undefined}
                >
                  {isHierarchyCreateLocationAction && isPhone ? <AddIcon fontSize="small" /> : action.label}
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
            topbarPrimaryAction.menuActions && topbarPrimaryAction.menuActions.length > 0 ? (
              <ButtonGroup variant="contained" size="small" sx={{ flexShrink: 0 }}>
                <Button
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={topbarPrimaryAction.onClick}
                  aria-label={topbarPrimaryAction.tooltip ?? topbarPrimaryAction.label}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', px: 1.25 }}
                >
                  {topbarPrimaryAction.label}
                </Button>
                <Button
                  aria-label="Weitere Optionen"
                  aria-controls={topbarPrimaryActionMenuAnchor ? 'topbar-primary-action-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={Boolean(topbarPrimaryActionMenuAnchor)}
                  onClick={(event) => setTopbarPrimaryActionMenuAnchor(event.currentTarget)}
                  sx={{ px: 0.5, minWidth: 28 }}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </Button>
              </ButtonGroup>
            ) : (
              <Tooltip title={topbarPrimaryAction.tooltip ?? topbarPrimaryAction.label}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleTopbarPrimaryAction}
                  aria-label={topbarPrimaryAction.tooltip ?? topbarPrimaryAction.label}
                  startIcon={!isPhone ? <AddIcon fontSize="small" /> : undefined}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: isPhone ? 44 : 'auto', minHeight: isPhone ? 44 : 'auto', px: isPhone ? 0.75 : 1.25, flexShrink: 0 }}
                >
                  {isPhone ? <AddIcon fontSize="small" /> : topbarPrimaryAction.label}
                </Button>
              </Tooltip>
            )
          ) : null}
            </Box>
          {topbarPrimaryAction?.menuActions && topbarPrimaryAction.menuActions.length > 0 ? (
            <Menu
              id="topbar-primary-action-menu"
              anchorEl={topbarPrimaryActionMenuAnchor}
              open={Boolean(topbarPrimaryActionMenuAnchor)}
              onClose={() => setTopbarPrimaryActionMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 0.5,
                    minWidth: topbarPrimaryActionMenuAnchor?.parentElement?.offsetWidth,
                  },
                },
              }}
            >
              {topbarPrimaryAction.menuActions.map((action) => (
                <MenuItem
                  key={action.id}
                  onClick={() => {
                    setTopbarPrimaryActionMenuAnchor(null);
                    action.onClick();
                  }}
                  disabled={action.disabled}
                >
                  <ListItemText primary={action.label} />
                </MenuItem>
              ))}
            </Menu>
          ) : null}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: TOPBAR_ACTION_GROUP_GAP, ml: TOPBAR_ACTION_GROUP_GAP, flexShrink: 0 }}>
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
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: isCulturesPage ? 0.25 : TOPBAR_ACTION_GROUP_GAP, flexShrink: 0 }}>
              {isCulturesPage ? (
                <>
                  {cultureLibraryAction ? (
                    <Tooltip title={t('cultureActions.openLibrary')} enterTouchDelay={0}>
                      <Box component="span" sx={{ display: 'inline-flex' }}>
                        <IconButton
                          size="small"
                          onClick={() => cultureLibraryAction.onClick()}
                          aria-label={t('cultureActions.openLibrary')}
                          sx={{
                            width: COMPACT_TOPBAR_TOGGLE_SIZE,
                            height: COMPACT_TOPBAR_TOGGLE_SIZE,
                            flexShrink: 0,
                            color: 'text.primary',
                            '& .MuiSvgIcon-root': { fontSize: 24 },
                          }}
                          disabled={cultureLibraryAction.disabled}
                        >
                          <PublicIcon />
                        </IconButton>
                      </Box>
                    </Tooltip>
                  ) : null}
                  {showCultureImportExportButton ? (
                    <Tooltip title={t('cultureActions.openImportExport')} enterTouchDelay={0}>
                      <IconButton
                        size="small"
                        aria-label={t('cultureActions.openImportExport')}
                        aria-controls={cultureActionsMenuAnchor ? 'culture-actions-menu-mobile' : undefined}
                        aria-haspopup="true"
                        aria-expanded={Boolean(cultureActionsMenuAnchor)}
                        onClick={handleCultureActionsMenuOpen}
                        sx={{
                          width: COMPACT_TOPBAR_TOGGLE_SIZE,
                          height: COMPACT_TOPBAR_TOGGLE_SIZE,
                          flexShrink: 0,
                          color: 'text.primary',
                          mr: 0.5,
                          '& .MuiSvgIcon-root': { fontSize: 24 },
                        }}
                      >
                        <FileExportIcon />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <Menu
                    id="culture-actions-menu-mobile"
                    anchorEl={cultureActionsMenuAnchor}
                    open={Boolean(cultureActionsMenuAnchor)}
                    onClose={handleCultureActionsMenuClose}
                  >
                    {cultureImportExportActions.map((action) => (
                      <MenuItem
                        key={`mobile-primary-${action.id}`}
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
              {showMobileTopbarViewActions ? (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: TOPBAR_ACTION_GROUP_GAP, flexShrink: 0 }}>
                  {mobileTopbarViewActions.length > 0 ? (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={activeMobileTopbarViewActionId}
                      aria-label={isCalendarPage ? t('ganttChart:modeAriaLabel') : t('fields:representation.ariaLabel')}
                      sx={{
                        flexShrink: 0,
                        '& .MuiToggleButton-root': {
                          width: COMPACT_TOPBAR_TOGGLE_SIZE,
                          height: COMPACT_TOPBAR_TOGGLE_SIZE,
                          p: 0,
                          borderColor: 'divider',
                          color: 'text.primary',
                          '&.Mui-selected': {
                            bgcolor: 'success.main',
                            color: 'success.contrastText',
                            borderColor: 'success.dark',
                            borderWidth: 2,
                            boxShadow: 1,
                          },
                          '&.Mui-selected:hover': {
                            bgcolor: 'success.dark',
                          },
                        },
                      }}
                    >
                      {mobileTopbarViewActions.map((action) => {
                        const isListViewAction = action.id === 'fields-view-mode-list';
                        const isGraphicalViewAction = action.id === 'fields-view-mode-graphical';
                        const isCalendarOccupancyAction = action.id === 'calendar-view-mode-occupancy';
                        const isCalendarSeedlingsAction = action.id === 'calendar-view-mode-seedlings';
                        const icon = isListViewAction
                          ? <ViewListOutlinedIcon fontSize="small" />
                          : isGraphicalViewAction
                            ? <MapOutlinedIcon fontSize="small" />
                            : isCalendarOccupancyAction
                              ? <EventNoteOutlinedIcon fontSize="small" />
                              : isCalendarSeedlingsAction
                                ? <LocalFloristOutlinedIcon fontSize="small" />
                                : null;
                        if (!icon) {
                          return null;
                        }
                        return (
                          <Tooltip key={action.id} title={action.tooltip ?? action.label} describeChild enterTouchDelay={0}>
                            <ToggleButton
                              value={action.id}
                              aria-label={action.ariaLabel ?? action.label}
                              onClick={action.onClick}
                              disabled={action.disabled}
                            >
                              {icon}
                            </ToggleButton>
                          </Tooltip>
                        );
                      })}
                    </ToggleButtonGroup>
                  ) : null}
                  {isFieldsBedsPage && fieldsGlobalAddAction ? (
                    <Tooltip title={fieldsGlobalAddAction.ariaLabel ?? fieldsGlobalAddAction.label} enterTouchDelay={0}>
                      <IconButton
                        size="small"
                        aria-label={fieldsGlobalAddAction.ariaLabel ?? fieldsGlobalAddAction.label}
                        onClick={(event) => {
                          if (fieldsGlobalAddAction.menuActions && fieldsGlobalAddAction.menuActions.length > 0) {
                            setTopbarPrimaryActionMenuAnchor(event.currentTarget);
                          } else {
                            fieldsGlobalAddAction.onClick();
                          }
                        }}
                        disabled={fieldsGlobalAddAction.disabled}
                        sx={{
                          width: COMPACT_TOPBAR_TOGGLE_SIZE,
                          height: COMPACT_TOPBAR_TOGGLE_SIZE,
                          bgcolor: 'success.main',
                          color: 'success.contrastText',
                          boxShadow: 1,
                          '&:hover': {
                            bgcolor: 'success.dark',
                          },
                          '&.Mui-disabled': {
                            bgcolor: 'action.disabledBackground',
                            color: 'action.disabled',
                          },
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  {mobileFieldsAddLocationAction ? (
                    <Tooltip title={mobileFieldsAddLocationAction.label}>
                      <IconButton
                        size="small"
                        aria-label={mobileFieldsAddLocationAction.ariaLabel ?? mobileFieldsAddLocationAction.label}
                        onClick={mobileFieldsAddLocationAction.onClick}
                        disabled={mobileFieldsAddLocationAction.disabled}
                        sx={{
                          width: COMPACT_TOPBAR_TOGGLE_SIZE,
                          height: COMPACT_TOPBAR_TOGGLE_SIZE,
                          bgcolor: 'success.main',
                          color: 'success.contrastText',
                          boxShadow: 1,
                          '&:hover': {
                            bgcolor: 'success.dark',
                          },
                          '&.Mui-disabled': {
                            bgcolor: 'action.disabledBackground',
                            color: 'action.disabled',
                          },
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Box>
              ) : null}
              {topbarPrimaryAction && !showMobileTopbarViewActions ? (
                <Tooltip title={topbarPrimaryAction.tooltip ?? topbarPrimaryAction.label}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={(event) => {
                      if (topbarPrimaryAction.menuActions && topbarPrimaryAction.menuActions.length > 0) {
                        setTopbarPrimaryActionMenuAnchor(event.currentTarget);
                        return;
                      }
                      handleTopbarPrimaryAction();
                    }}
                    aria-label={topbarPrimaryAction.tooltip ?? topbarPrimaryAction.label}
                    aria-controls={topbarPrimaryActionMenuAnchor ? 'topbar-primary-action-menu' : undefined}
                    aria-haspopup={topbarPrimaryAction.menuActions && topbarPrimaryAction.menuActions.length > 0 ? 'true' : undefined}
                    aria-expanded={Boolean(topbarPrimaryActionMenuAnchor)}
                    sx={{ textTransform: 'none', minWidth: 32, px: 0.75, minHeight: 30 }}
                  >
                    <AddIcon fontSize="small" />
                  </Button>
                </Tooltip>
              ) : null}
              {topbarPrimaryAction?.menuActions && topbarPrimaryAction.menuActions.length > 0 ? (
                <Menu
                  id="topbar-primary-action-menu"
                  anchorEl={topbarPrimaryActionMenuAnchor}
                  open={Boolean(topbarPrimaryActionMenuAnchor)}
                  onClose={() => setTopbarPrimaryActionMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{ paper: { sx: { mt: 0.5 } } }}
                >
                  {topbarPrimaryAction.menuActions.map((action) => (
                    <MenuItem
                      key={action.id}
                      onClick={() => {
                        setTopbarPrimaryActionMenuAnchor(null);
                        action.onClick();
                      }}
                      disabled={action.disabled}
                    >
                      <ListItemText primary={action.label} />
                    </MenuItem>
                  ))}
                </Menu>
              ) : null}
              <IconButton
                aria-label="Mehr"
                aria-controls={globalMenuAnchor ? 'global-actions-menu' : undefined}
                aria-haspopup="true"
                onClick={handleGlobalMenuOpen}
                sx={{ color: 'text.primary' }}
              >
                <MoreVertIcon />
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: TOPBAR_ACTION_GROUP_GAP, minHeight: 36, flexWrap: 'wrap', whiteSpace: 'normal', width: '100%' }}>
              {isCulturesPage ? (
                <>
                  {cultureLibraryAction ? (
                    <Tooltip title={t('cultureActions.openLibrary')} enterTouchDelay={0}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => cultureLibraryAction.onClick()}
                          aria-label={t('cultureActions.openLibrary')}
                          sx={{ color: 'text.primary' }}
                          disabled={cultureLibraryAction.disabled}
                        >
                          <PublicIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                  {showCultureImportExportButton || isMobile ? (
                    <Tooltip title={t('cultureActions.openImportExport')} enterTouchDelay={0}>
                      <IconButton
                        size="small"
                        aria-label={t('cultureActions.openImportExport')}
                        aria-controls={cultureActionsMenuAnchor ? 'culture-actions-menu-mobile' : undefined}
                        aria-haspopup="true"
                        aria-expanded={Boolean(cultureActionsMenuAnchor)}
                        onClick={handleCultureActionsMenuOpen}
                        sx={{ color: 'text.primary' }}
                      >
                        <FileExportIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
                  const content = group.map((action) => {
                    const isHierarchyCreateLocationAction = action.id === HIERARCHY_CREATE_LOCATION_ACTION_ID;
                    return (
                      <Button
                        key={action.id}
                        size="small"
                        variant={isHierarchyCreateLocationAction || action.active ? 'contained' : 'outlined'}
                        color={action.active ? 'success' : isHierarchyCreateLocationAction ? 'primary' : 'inherit'}
                        onClick={action.onClick}
                        aria-label={action.ariaLabel ?? action.label}
                        aria-pressed={action.active}
                        disabled={action.disabled}
                        startIcon={isHierarchyCreateLocationAction && !isPhone ? <AddIcon fontSize="small" /> : undefined}
                        sx={isHierarchyCreateLocationAction
                          ? {
                            textTransform: 'none',
                            whiteSpace: 'nowrap',
                            minWidth: isPhone ? 32 : 'auto',
                            px: isPhone ? 0.75 : 1.25,
                            minHeight: 30,
                            ...(action.hidden ? { display: 'none' } : {}),
                          }
                          : {
                            ...getSegmentedActionButtonSx({ active: Boolean(action.active), hidden: Boolean(action.hidden) }),
                            minHeight: 30,
                            px: 1,
                          }}
                      >
                        {isHierarchyCreateLocationAction && isPhone ? <AddIcon fontSize="small" /> : action.label}
                      </Button>
                    );
                  });
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

      <Drawer anchor="left" open={mobileNavOpen} onClose={closeMobileNav} PaperProps={{ sx: mobileNavigationDrawerPaperSx }}>
        <List sx={{ width: 280, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <ListItem sx={{ py: 1.5, px: 2 }}>
            <AppLogo size={26} showText to="/app/dashboard" />
          </ListItem>
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || item.activeAliases.includes(location.pathname);
            return (
                <ListItem key={item.to} disablePadding>
                  <ListItemButton
                  component={RouterLink as React.ElementType}
                  to={item.to}
                  selected={isActive}
                  onClick={closeMobileNav}
                  sx={getMobileNavigationItemSx(isActive)}
                >
                  <ListItemIcon sx={getMobileNavigationIconSx(isActive)}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={getMobileNavigationTextProps(isActive)} />
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
        <Outlet context={{ setTopbarContextActions, setTopbarTitleActions } satisfies RootLayoutOutletContext} />
      </Box>
      </Box>

      <Dialog open={projectHistoryOpen} onClose={() => setProjectHistoryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('commandPalette.commands.openVersionHistory')}</DialogTitle>
        <DialogContent sx={{ py: isPhonePortrait ? 1 : 2 }}>
          {historyItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('commandPalette.versionHistoryEmpty')}
            </Typography>
          ) : null}
          <List>
            {historyItems.map((item, index) => {
              const isCurrentVersion = isCurrentHistoryEntry(item, index);
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
            <Typography variant="subtitle2">{t('commandPalette.shortcutSections.navigation')}</Typography>
            <List dense disablePadding>
              <ListItem><ListItemText primary={t('commandPalette.createNewShortcut')} secondary="Alt+Shift+N" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.nextPage')} secondary="Ctrl+Shift+↓" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.previousPage')} secondary="Ctrl+Shift+↑" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.openVersionHistory')} secondary="Alt+V" /></ListItem>
            </List>
            <Typography variant="subtitle2">{t('commandPalette.shortcutSections.viewsLayout')}</Typography>
            <List dense disablePadding>
              <ListItem><ListItemText primary={t('commandPalette.commands.toggleSidebar')} secondary="Ctrl+B" /></ListItem>
            </List>
            <Typography variant="subtitle2">{t('commandPalette.contextTitles.calendar')}</Typography>
            <List dense disablePadding>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarToday')} secondary="T" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarPreviousPeriod')} secondary="←" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarNextPeriod')} secondary="→" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarDayView')} secondary="1" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarWeekView')} secondary="2" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarMonthView')} secondary="3" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarQuarterView')} secondary="4" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarYearView')} secondary="5" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarOccupancy')} secondary="F" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarSeedlings')} secondary="A" /></ListItem>
              <ListItem><ListItemText primary={t('commandPalette.commands.calendarToggleMove')} secondary="Z" /></ListItem>
            </List>
            <Typography variant="subtitle2">{t('commandPalette.shortcutSections.dialogsHelp')}</Typography>
            <List dense disablePadding>
              <ListItem><ListItemText primary={t('commandPalette.commands.openPageHelp')} secondary="Alt+H" /></ListItem>
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
            {t('projectSwitcher.activeProject')}
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.25, mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckIcon fontSize="small" color="success" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{activeProjectLabel}</Typography>
            </Stack>
          </Paper>
          <Typography variant="caption" sx={{ display: 'block', mb: 1.25, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {t('projectSwitcher.projects')}
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
          <Button autoFocus variant="outlined" onClick={() => setPendingRestoreEntry(null)}>Abbrechen</Button>
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


      <Dialog open={isCreateProjectOpen} onClose={closeCreateProjectDialog} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleCreateProjectSubmit}>
          <DialogTitle>{t('projectSwitcher.createDialogTitle')}</DialogTitle>
          <DialogContent sx={{ pt: 1, pb: 1 }}>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <TextField
                label={t('projectSwitcher.createNameLabel')}
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                autoFocus
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeCreateProjectDialog}>{t('projectSwitcher.createCancel')}</Button>
            <Button type="submit" variant="contained" disabled={!newProjectName.trim() || isCreatingProject}>
              {t('projectSwitcher.createSubmit')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          closeText={t('common:actions.close')}
          sx={{ width: '100%' }}
          action={snackbar.actionLabel && snackbar.onAction ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setSnackbar((prev) => ({ ...prev, open: false }));
                snackbar.onAction?.();
              }}
            >
              {snackbar.actionLabel}
            </Button>
          ) : undefined}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function LegacyInvitationRedirect() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');
  if (!token) {
    return <Navigate to="/invite/invalid" replace />;
  }
  return <Navigate to={buildInvitationAcceptPath(token)} replace />;
}

function TokenInvitationRedirect() {
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

function RouteErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const isApplicationUpdateError = isDynamicImportLoadError(error);
  const routeKey = `${location.pathname}${location.search}`;
  const [isReloading] = useState(() => shouldAutomaticallyReloadForRouteLoadError(routeKey));

  useEffect(() => {
    if (isReloading) {
      reloadPage();
    }
  }, [isReloading]);

  if (isReloading) {
    return null;
  }

  return <RuntimeErrorState variant={isApplicationUpdateError ? 'applicationUpdated' : 'routeError'} />;
}

interface GlobalRuntimeErrorHandlerProps {
  children: React.ReactNode;
}

function GlobalRuntimeErrorHandler({ children }: GlobalRuntimeErrorHandlerProps) {
  const [hasApplicationUpdateError, setHasApplicationUpdateError] = useState(false);

  const handleDynamicImportError = useCallback((error: unknown) => {
    if (!isDynamicImportLoadError(error)) {
      return;
    }

    if (!reloadOnceForDynamicImportError(error)) {
      setHasApplicationUpdateError(true);
    }
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = event.error ?? event.message;
      if (!isDynamicImportLoadError(error)) {
        return;
      }

      event.preventDefault();
      handleDynamicImportError(error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isDynamicImportLoadError(event.reason)) {
        return;
      }

      event.preventDefault();
      handleDynamicImportError(event.reason);
    };

    const handleVitePreloadError = (event: Event) => {
      event.preventDefault();
      const payload = (event as CustomEvent<unknown>).detail
        ?? (event as Event & { payload?: unknown }).payload
        ?? 'vite:preloadError';
      handleDynamicImportError(payload);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('vite:preloadError', handleVitePreloadError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('vite:preloadError', handleVitePreloadError);
    };
  }, [handleDynamicImportError]);

  if (hasApplicationUpdateError) {
    return <RuntimeErrorState variant="applicationUpdated" />;
  }

  return children;
}

function createAppRouter(basename: string) {
  return createBrowserRouter([
    {
      path: '/',
      element: <Outlet />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: withLazyFallback(<HomePage />),
        },
        {
          path: 'impressum',
          element: withLazyFallback(<ImprintPage />),
        },
        {
          path: 'datenschutz',
          element: withLazyFallback(<PrivacyPolicyPage />),
        },
        {
          path: 'login',
          element: withLazyFallback(<LoginPage />),
        },
        {
          path: 'register',
          element: withLazyFallback(<RegisterPage />),
        },
        {
          path: 'activate',
          element: withLazyFallback(<ActivatePage />),
        },
        {
          path: 'activate/:uid/:token',
          element: withLazyFallback(<ActivatePage />),
        },
        {
          path: 'forgot-password',
          element: withLazyFallback(<ForgotPasswordPage />),
        },
        {
          path: 'reset-password',
          element: withLazyFallback(<ResetPasswordPage />),
        },
        {
          path: 'confirm-email-change',
          element: withLazyFallback(<ConfirmEmailChangePage />),
        },
        {
          path: 'invitation',
          element: <LegacyInvitationRedirect />,
        },
        {
          path: 'invite/accept',
          element: withLazyFallback(<InvitationAcceptPage />),
        },
        {
          path: 'invite/:token',
          element: <TokenInvitationRedirect />,
        },
        {
          path: 'app',
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
                { path: 'yield-overview', element: withLazyFallback(<YieldOverviewPage />) },
                { path: 'seed-demand', element: withLazyFallback(<SeedDemandPage />) },
                { path: 'project-selection', element: withLazyFallback(<ProjectSelectionPage />) },
                { path: 'account-settings', element: withLazyFallback(<AccountSettingsPage />) },
                { path: 'project-settings', element: withLazyFallback(<ProjectSettingsPage />) },
                { path: '*', element: <Navigate to="/app/dashboard" replace /> },
              ],
            },
          ],
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ], {
    basename,
  });
}

function App() {
  // Use Vite's base URL when URL is inside that subdirectory, otherwise fall back to root.
  const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const currentPath = window.location.pathname;
  const basename = resolveRouterBasename(configuredBase, currentPath);

  const router = useMemo(() => createAppRouter(basename), [basename]);

  return (
    <GlobalRuntimeErrorHandler>
      <RouterProvider router={router} />
    </GlobalRuntimeErrorHandler>
  );
}

export default App;
