/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, RouterProvider, Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
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
} from '@mui/material';
import { useTranslation } from './i18n';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useRegisterCommands } from './commands/CommandProvider';
import type { CommandSpec } from './commands/types';
import { useMemo, useState } from 'react';
import Home from './pages/Home';
import Locations from './pages/Locations';
import FieldsBedsHierarchy from './pages/FieldsBedsHierarchy';
import Cultures from './pages/Cultures';
import PlantingPlans from './pages/PlantingPlans';
import GanttChart from './pages/GanttChart';
import SeedDemandPage from './pages/SeedDemand';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { cultureAPI } from './api/api';
import type { CultureHistoryEntry } from './api/types';
import './App.css';


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
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<null | HTMLElement>(null);
  const routes = ['/', '/locations', '/fields-beds', '/cultures', '/planting-plans', '/gantt-chart', '/seed-demand'];

  const handleGlobalMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setGlobalMenuAnchor(event.currentTarget);
  };

  const handleGlobalMenuClose = () => {
    setGlobalMenuAnchor(null);
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
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link home active" : "nav-link home"}>
            {t('home')}
          </NavLink>
          <NavLink to="/locations" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('locations')}
          </NavLink>
          <NavLink to="/fields-beds" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('fieldsAndBeds')}
          </NavLink>
          <NavLink to="/cultures" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('cultures')}
          </NavLink>
          <NavLink to="/planting-plans" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('plantingPlans')}
          </NavLink>
          <NavLink to="/gantt-chart" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('ganttChart')}
          </NavLink>
          <NavLink to="/seed-demand" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {t('seedDemand')}
          </NavLink>
        </div>
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
          </Menu>
        </div>
      </nav>

      <Outlet />

      <Dialog open={projectHistoryOpen} onClose={() => setProjectHistoryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Versionsverlauf</DialogTitle>
        <DialogContent>
          <List>
            {historyItems.map((item) => (
              <ListItem
                key={item.history_id}
                secondaryAction={
                  <Button onClick={() => void handleRestoreProjectVersion(item.history_id)}>Restore this version</Button>
                }
              >
                <ListItemText
                  primary={new Date(item.history_date).toLocaleString()}
                  secondary={`${item.summary}${item.culture_id ? ` (Kultur #${item.culture_id})` : ''}`}
                />
              </ListItem>
            ))}
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
      element: <RootLayout />,
      children: [
        {
          index: true,
          element: <Home />,
        },
        {
          path: 'locations',
          element: <Locations />,
        },
        {
          path: 'fields-beds',
          element: <FieldsBedsHierarchy />,
        },
        {
          path: 'cultures',
          element: <Cultures />,
        },
        {
          path: 'planting-plans',
          element: <PlantingPlans />,
        },
        {
          path: 'gantt-chart',
          element: <GanttChart />,
        },
        {
          path: 'seed-demand',
          element: <SeedDemandPage />,
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
