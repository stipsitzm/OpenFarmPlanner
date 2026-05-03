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
  Button,
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
  Snackbar,
  Stack,
  TextField,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from './i18n';
import { useCommandContext, useRegisterCommands } from './commands/useCommandContext';
import { createRootCommands } from './commands/commands';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Locations from './pages/Locations';
import FieldsBedsPage from './pages/FieldsBedsPage';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import GanttChart from './pages/GanttChart';
import SeedDemandPage from './pages/SeedDemand';
import Suppliers from './pages/Suppliers';
import Dashboard from './pages/Dashboard';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MenuIcon from '@mui/icons-material/Menu';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import { cultureAPI, projectAPI } from './api/api';
import type { CultureHistoryEntry } from './api/types';
import './App.css';
import { useAuth } from './auth/useAuth';
import ProtectedRoute from './auth/ProtectedRoute';
import HomePage from './pages/public/HomePage';
import ImprintPage from './pages/public/ImprintPage';
import PrivacyPolicyPage from './pages/public/PrivacyPolicyPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ActivatePage from './pages/auth/ActivatePage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ConfirmEmailChangePage from './pages/auth/ConfirmEmailChangePage';
import ProjectSelectionPage from './pages/ProjectSelectionPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import InvitationAcceptPage from './pages/InvitationAcceptPage';
import AppLogo from './components/layout/AppLogo';
import { buildInvitationAcceptPath } from './pages/invitationAcceptance';
import { getHistoryEntryMeta, getHistoryEntryTarget, getHistoryEntryTitle } from './pages/culturesHistoryUtils';
import { resolveRouterBasename } from './routerBasename';
import { OPEN_CREATE_PROJECT_EVENT } from './projects/projectCreationFlow';
import { MAIN_NAV_ITEMS, MAIN_NAV_ROUTES, normalizeMainRoutePath } from './navigation/mainNavigation';

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
        {t('project.settings')}
      </MenuItem>
      <Divider />
      <MenuItem onClick={onOpenCreateProject}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AddIcon fontSize="small" />
          <span>{t('project.create')}</span>
        </Stack>
      </MenuItem>
    </Menu>
  );
}

interface GlobalMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  historyLoading: boolean;
  userLabel: string;
  onClose: () => void;
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
    onClose,
    onOpenProjectHistory,
    onOpenAccountSettings,
    onOpenShortcuts,
    onOpenHelp,
    onLogout,
    t,
  } = props;

  return (
    <Menu
      id="global-actions-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
    >
      <MenuItem onClick={() => void onOpenProjectHistory()} disabled={historyLoading}>
        {t('commandPalette.commands.openVersionHistory')}
      </MenuItem>
      <MenuItem onClick={onOpenAccountSettings}>
        {t('accountSettings')}
      </MenuItem>
      <MenuItem onClick={onOpenShortcuts}>
        Tastenkürzel
      </MenuItem>
      <MenuItem onClick={onOpenHelp}>
        Hilfe
      </MenuItem>
      <MenuItem onClick={() => void onLogout()}>
        {t('commandPalette.commands.logout')} {userLabel}
      </MenuItem>
    </Menu>
  );
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
  const isCompactDesktop = useMediaQuery('(max-width:1365px)');
  const { user, logout, activeProjectId, switchActiveProject } = useAuth();
  const fallbackHistoryActorLabel = user?.display_label || user?.display_name || user?.email || undefined;
  const { openPalette } = useCommandContext();
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<null | HTMLElement>(null);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreNavAnchor, setMoreNavAnchor] = useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSwitchingProject, setIsSwitchingProject] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const navItems = useMemo(() => (
    MAIN_NAV_ITEMS.map((item) => ({
      to: item.to,
      label: t(item.labelKey),
      activeAliases: item.activeAliases ?? [],
      keywords: item.keywords,
    }))
  ), [t]);
  const primaryNavItems = (isCompactDesktop && !isMobile) ? navItems.slice(0, 5) : navItems;
  const overflowNavItems = (isCompactDesktop && !isMobile) ? navItems.slice(5) : [];

  const handleGlobalMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setGlobalMenuAnchor(event.currentTarget);
  };

  const handleGlobalMenuClose = () => {
    setGlobalMenuAnchor(null);
  };

  const handleProjectMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProjectMenuAnchor(event.currentTarget);
  };

  const handleProjectMenuClose = () => {
    setProjectMenuAnchor(null);
  };
  const handleMoreNavOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMoreNavAnchor(event.currentTarget);
  };
  const handleMoreNavClose = () => {
    setMoreNavAnchor(null);
  };

  const closeMobileNav = () => {
    setMobileNavOpen(false);
  };

  const [projectHistoryOpen, setProjectHistoryOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<CultureHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenProjectHistory = async () => {
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
  };

  const handleRestoreProjectVersion = async (historyId: number) => {
    try {
      await cultureAPI.projectRestore(historyId);
      showSnackbar(t('commandPalette.feedback.versionRestored'), 'success');
      setProjectHistoryOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error restoring project version:', error);
      showSnackbar(t('commandPalette.feedback.versionRestoreError'), 'error');
    }
  };

  const handleOpenShortcuts = () => {
    handleGlobalMenuClose();
    setShortcutsOpen(true);
  };

  const openCurrentPageHelp = (): void => {
    window.dispatchEvent(new CustomEvent('ofp:open-page-help'));
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      handleGlobalMenuClose();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error logging out:', error);
      showSnackbar(t('commandPalette.feedback.logoutError'), 'error');
    }
  };

  const memberships = user?.memberships ?? [];
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

  const handleOpenProjectSettings = (): void => {
    handleProjectMenuClose();
    navigate('/app/project-settings');
  };

  const applyProjectContextChange = async (projectId: number): Promise<void> => {
    await switchActiveProject(projectId);
    window.location.reload();
  };

  const closeCreateProjectDialog = (): void => {
    setIsCreateProjectOpen(false);
    setNewProjectName('');
    setNewProjectDescription('');
  };

  const navigateFromGlobalMenu = (path: string): void => {
    handleGlobalMenuClose();
    navigate(path);
  };

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

  const handleSwitchProject = async (projectId: number): Promise<void> => {
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
  };

  const activeMembershipRole = activeMembership?.role ?? null;

  const getCurrentRouteFromLocation = useCallback((): string => {
    const pathname = window.location.pathname || location.pathname;
    return normalizeMainRoutePath(pathname);
  }, [location.pathname]);

  const goToNextPage = useCallback((): void => {
    const currentIndex = MAIN_NAV_ROUTES.indexOf(getCurrentRouteFromLocation());
    if (currentIndex === -1) {
      navigate('/app/dashboard');
      return;
    }
    if (currentIndex >= MAIN_NAV_ROUTES.length - 1) {
      return;
    }
    navigate(MAIN_NAV_ROUTES[currentIndex + 1]);
  }, [getCurrentRouteFromLocation, navigate]);

  const goToPreviousPage = useCallback((): void => {
    const currentIndex = MAIN_NAV_ROUTES.indexOf(getCurrentRouteFromLocation());
    if (currentIndex <= 0) {
      navigate('/app/dashboard');
      return;
    }
    navigate(MAIN_NAV_ROUTES[currentIndex - 1]);
  }, [getCurrentRouteFromLocation, navigate]);

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
  
  return (
    <div className="app">
      <nav className="nav">
        {isMobile ? (
          <div className="mobile-nav-row">
            <IconButton
              aria-label="Menü öffnen"
              onClick={() => setMobileNavOpen(true)}
              size="small"
              sx={{ color: 'white' }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
            <AppLogo
              size={24}
              showText={false}
              to="/app/dashboard"
            />
          </div>
        ) : (
          <div className="nav-links">
            <AppLogo
              size={28}
              showText={!isCompactDesktop}
              to="/app/dashboard"
            />
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive || item.activeAliases.includes(location.pathname)) ? 'nav-link active' : 'nav-link'}
              >
                {item.label}
              </NavLink>
            ))}
            {overflowNavItems.length > 0 ? (
              <>
                <Button
                  size="small"
                  onClick={handleMoreNavOpen}
                  aria-controls={moreNavAnchor ? 'more-nav-menu' : undefined}
                  aria-haspopup="true"
                  sx={{ color: 'white', textTransform: 'none', px: 1 }}
                >
                  Mehr
                </Button>
                <Menu id="more-nav-menu" anchorEl={moreNavAnchor} open={Boolean(moreNavAnchor)} onClose={handleMoreNavClose}>
                  {overflowNavItems.map((item) => {
                    const isActive = location.pathname === item.to || item.activeAliases.includes(location.pathname);
                    return (
                      <MenuItem
                        key={item.to}
                        selected={Boolean(isActive)}
                        onClick={() => {
                          navigate(item.to);
                          handleMoreNavClose();
                        }}
                      >
                        {item.label}
                      </MenuItem>
                    );
                  })}
                </Menu>
              </>
            ) : null}
          </div>
        )}
        <div className="nav-actions">
          <Button
            aria-label={t('projectSwitcher.ariaLabel')}
            aria-controls={projectMenuAnchor ? 'project-switcher-menu' : undefined}
            aria-haspopup="true"
            onClick={handleProjectMenuOpen}
            size="small"
            disabled={isSwitchingProject}
            sx={{
              color: 'white',
              textTransform: 'none',
              maxWidth: { xs: 180, sm: 260, md: 320 },
              minWidth: 0,
            }}
            startIcon={<FolderOpenOutlinedIcon fontSize="small" />}
            endIcon={<KeyboardArrowDownIcon fontSize="small" />}
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
            sx={{ color: 'white' }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <GlobalMenu
            anchorEl={globalMenuAnchor}
            open={Boolean(globalMenuAnchor)}
            historyLoading={historyLoading}
            userLabel={user?.email ? `(${user.email})` : (user?.display_label ? `(${user.display_label})` : '')}
            onClose={handleGlobalMenuClose}
            onOpenProjectHistory={handleOpenProjectHistory}
            onOpenAccountSettings={() => navigateFromGlobalMenu('/app/account-settings')}
            onOpenShortcuts={handleOpenShortcuts}
            onOpenHelp={openCurrentPageHelp}
            onLogout={handleLogout}
            t={t}
          />
        </div>
      </nav>

      <Drawer anchor="left" open={mobileNavOpen} onClose={closeMobileNav}>
        <List sx={{ width: 280 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || item.activeAliases.includes(location.pathname);
            return (
              <ListItem key={item.to} disablePadding>
                <Button
                  fullWidth
                  onClick={() => {
                    navigate(item.to);
                    closeMobileNav();
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    borderRadius: 0,
                    px: 2,
                    py: 1.5,
                    color: isActive ? 'primary.main' : 'text.primary',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {item.label}
                </Button>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      <Outlet />

      <Dialog open={projectHistoryOpen} onClose={() => setProjectHistoryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('commandPalette.commands.openVersionHistory')}</DialogTitle>
        <DialogContent>
          <List>
            {historyItems.map((item, index) => {
              const isCurrentVersion = index === 0;
              const historyTarget = getHistoryEntryTarget(item);

              return (
                <ListItem
                  key={item.history_id}
                  disableGutters
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
                    <ListItemText
                      sx={{ mr: 1 }}
                      primary={(
                        <>
                          {getHistoryEntryTitle(item, tCultures)}
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
                      secondary={getHistoryEntryMeta(item, tCultures, fallbackHistoryActorLabel)}
                    />
                    {isCurrentVersion
                      ? <Chip label={t('commandPalette.currentVersion')} size="small" color="success" variant="outlined" />
                      : <Button onClick={() => void handleRestoreProjectVersion(item.history_id)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{t('commandPalette.restoreVersion')}</Button>}
                  </Stack>
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
          <List dense>
            <ListItem>
              <ListItemText primary={t('commandPalette.commands.openShortcuts')} secondary="Alt+H" />
            </ListItem>
            <ListItem>
              <ListItemText primary={t('commandPalette.label')} secondary="Alt+K" />
            </ListItem>
            <ListItem>
              <ListItemText primary={t('commandPalette.commands.openVersionHistory')} secondary="–" />
            </ListItem>
            <ListItem>
              <ListItemText primary={t('commandPalette.commands.closeDialog')} secondary="Esc" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShortcutsOpen(false)}>{t('common:actions.close')}</Button>
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
    </div>
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

function createAppRouter(basename: string) {
  return createBrowserRouter([
    {
      path: '/',
      element: <HomePage />,
    },
    {
      path: '/impressum',
      element: <ImprintPage />,
    },
    {
      path: '/datenschutz',
      element: <PrivacyPolicyPage />,
    },
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      path: '/register',
      element: <RegisterPage />,
    },
    {
      path: '/activate',
      element: <ActivatePage />,
    },
    {
      path: '/forgot-password',
      element: <ForgotPasswordPage />,
    },
    {
      path: '/reset-password',
      element: <ResetPasswordPage />,
    },
    {
      path: '/confirm-email-change',
      element: <ConfirmEmailChangePage />,
    },
    {
      path: '/invitation',
      element: <LegacyInvitationRedirect />,
    },
    {
      path: '/invite/accept',
      element: <InvitationAcceptPage />,
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
            { path: 'dashboard', element: <Dashboard /> },
            { path: 'locations', element: <Locations /> },
            { path: 'fields-beds', element: <FieldsBedsPage /> },
            { path: 'cultures', element: <Cultures /> },
            { path: 'anbauplaene', element: <PlantingPlans /> },
            { path: 'suppliers', element: <Suppliers /> },
            { path: 'planting-plans', element: <PlantingPlans /> },
            { path: 'gantt-chart', element: <GanttChart /> },
            { path: 'seed-demand', element: <SeedDemandPage /> },
            { path: 'project-selection', element: <ProjectSelectionPage /> },
            { path: 'account-settings', element: <AccountSettingsPage /> },
            { path: 'project-settings', element: <ProjectSettingsPage /> },
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
