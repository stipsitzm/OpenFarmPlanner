/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, RouterProvider, Outlet, NavLink, redirect, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from './i18n';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useRegisterCommands } from './commands/CommandProvider';
import type { CommandSpec } from './commands/types';
import { useMemo, useState } from 'react';
import Locations from './pages/Locations';
import FieldsBedsPage from './pages/FieldsBedsPage';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import GanttChart from './pages/GanttChart';
import SeedDemandPage from './pages/SeedDemand';
import Suppliers from './pages/Suppliers';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MenuIcon from '@mui/icons-material/Menu';
import { cultureAPI } from './api/api';
import type { CultureHistoryEntry } from './api/types';
import './App.css';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import HomePage from './pages/public/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';


/**
 * Root layout component with navigation.
 * Wraps all routes with the persistent navigation bar.
 */
function RootLayout(): React.ReactElement {
  const { t } = useTranslation('navigation');
  // Re-enable Ctrl+Shift+Arrow route switching
  useKeyboardNavigation();

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const routes = ['/app/locations', '/app/fields-beds', '/app/cultures', '/app/anbauplaene', '/app/gantt-chart', '/app/seed-demand', '/app/suppliers'];
  const navItems = [
    { to: '/app/locations', label: t('locations') },
    { to: '/app/fields-beds', label: t('fieldsAndBeds') },
    { to: '/app/cultures', label: t('cultures') },
    { to: '/app/anbauplaene', label: t('plantingPlans'), activePath: '/app/planting-plans' },
    { to: '/app/gantt-chart', label: t('ganttChart') },
    { to: '/app/seed-demand', label: t('seedDemand') },
    { to: '/app/suppliers', label: t('suppliers') },
  ];

  const handleGlobalMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setGlobalMenuAnchor(event.currentTarget);
  };

  const handleGlobalMenuClose = () => {
    setGlobalMenuAnchor(null);
  };

  const closeMobileNav = () => {
    setMobileNavOpen(false);
  };

  const [projectHistoryOpen, setProjectHistoryOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<CultureHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
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
      showSnackbar('Versionsverlauf konnte nicht geladen werden.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRestoreProjectVersion = async (historyId: number) => {
    try {
      await cultureAPI.projectRestore(historyId);
      showSnackbar('Projektversion wurde wiederhergestellt.', 'success');
      setProjectHistoryOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error restoring project version:', error);
      showSnackbar('Projektversion konnte nicht wiederhergestellt werden.', 'error');
    }
  };

  const handleOpenShortcuts = () => {
    handleGlobalMenuClose();
    setShortcutsOpen(true);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      handleGlobalMenuClose();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error logging out:', error);
      showSnackbar('Logout failed. Please try again.', 'error');
    }
  };

  const globalCommands = useMemo<CommandSpec[]>(() => [
    {
      id: 'global.nextPage',
      title: 'Nächste Seite (Ctrl+Shift+→)',
      keywords: ['seite', 'nächste', 'navigation'],
      shortcutHint: 'Ctrl+Shift+→',
      contextTags: ['global'],
      isAvailable: () => true,
      run: () => {
        const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
        const currentIndex = routes.indexOf(normalizedPath);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % routes.length;
        navigate(routes[nextIndex]);
      },
    },
    {
      id: 'global.openVersionHistory',
      title: 'Versionsverlauf öffnen (Alt+Shift+V)',
      keywords: ['versionsverlauf', 'history', 'projekt'],
      shortcutHint: 'Alt+Shift+V',
      keys: { alt: true, shift: true, key: 'V' },
      contextTags: ['global'],
      isAvailable: () => true,
      run: () => {
        void handleOpenProjectHistory();
      },
    },
    {
      id: 'global.previousPage',
      title: 'Vorherige Seite (Ctrl+Shift+←)',
      keywords: ['seite', 'vorherige', 'navigation'],
      shortcutHint: 'Ctrl+Shift+←',
      contextTags: ['global'],
      isAvailable: () => true,
      run: () => {
        const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
        const currentIndex = routes.indexOf(normalizedPath);
        const previousIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + routes.length) % routes.length;
        navigate(routes[previousIndex]);
      },
    },
  ], [location.pathname, navigate]);

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
            <span className="mobile-nav-title">OpenFarmPlanner</span>
          </div>
        ) : (
          <div className="nav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive || location.pathname === item.activePath) ? 'nav-link active' : 'nav-link'}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
        <div className="nav-actions">
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
          <Menu
            id="global-actions-menu"
            anchorEl={globalMenuAnchor}
            open={Boolean(globalMenuAnchor)}
            onClose={handleGlobalMenuClose}
          >
            <MenuItem onClick={() => void handleOpenProjectHistory()} disabled={historyLoading}>
              Versionsverlauf…
            </MenuItem>
            <MenuItem onClick={handleOpenShortcuts}>
              Tastenkürzel
            </MenuItem>
            <MenuItem onClick={() => void handleLogout()}>
              Logout {user?.username ? `(${user.username})` : ''}
            </MenuItem>
          </Menu>
        </div>
      </nav>

      <Drawer anchor="left" open={mobileNavOpen} onClose={closeMobileNav}>
        <List sx={{ width: 280 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || location.pathname === item.activePath;
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
        <DialogTitle>Versionsverlauf</DialogTitle>
        <DialogContent>
          <List>
            {historyItems.map((item, index) => {
              const isCurrentVersion = index === 0;

              return (
                <ListItem
                  key={item.history_id}
                  secondaryAction={
                    isCurrentVersion
                      ? <Chip label="Aktuelle Version" size="small" color="success" variant="outlined" />
                      : <Button onClick={() => void handleRestoreProjectVersion(item.history_id)}>Wiederherstellen</Button>
                  }
                >
                  <ListItemText
                    primary={new Date(item.history_date).toLocaleString()}
                    secondary={`${item.summary}${item.culture_id ? ` (Kultur #${item.culture_id})` : ''}`}
                  />
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tastenkürzel</DialogTitle>
        <DialogContent>
          <List dense>
            <ListItem>
              <ListItemText primary="Tastenkürzel öffnen" secondary="?" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Command Palette" secondary="Alt+K" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Versionsverlauf öffnen" secondary="Alt+Shift+V" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Dialog schließen" secondary="Esc" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShortcutsOpen(false)}>Schließen</Button>
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

/**
 * Create the router with data router API
 */
function createAppRouter(basename: string) {
  return createBrowserRouter([
    {
      path: '/',
      element: <HomePage />,
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
      path: '/app',
      element: <ProtectedRoute />,
      children: [
        {
          path: '',
          element: <RootLayout />,
          children: [
            {
              index: true,
              loader: () => redirect('/app/anbauplaene'),
            },
            { path: 'locations', element: <Locations /> },
            { path: 'fields-beds', element: <FieldsBedsPage /> },
            { path: 'cultures', element: <Cultures /> },
            { path: 'anbauplaene', element: <PlantingPlans /> },
            { path: 'suppliers', element: <Suppliers /> },
            { path: 'planting-plans', element: <PlantingPlans /> },
            { path: 'gantt-chart', element: <GanttChart /> },
            { path: 'seed-demand', element: <SeedDemandPage /> },
          ],
        },
      ],
    },
  ], {
    basename,
  });
}

function App(): React.ReactElement {
  // Use Vite's base URL to set React Router basename so routes work under a subdirectory
  // Vite provides BASE_URL ending with a trailing slash (e.g., "/openfarmplanner/")
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  
  const router = createAppRouter(basename);
  
  return <RouterProvider router={router} />;
}

export default App;
