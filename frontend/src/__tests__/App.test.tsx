import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { resolveRouterBasename } from '../routerBasename';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';
import translations from '@/test-utils/translations';
import type { AuthUser } from '../auth/types';

const authState = {
  user: null as AuthUser | null,
  isLoading: false,
  activeProjectId: null as number | null,
  login: vi.fn(async () => ({}) as AuthUser),
  logout: vi.fn(async () => {}),
  register: vi.fn(async () => 'ok'),
  activate: vi.fn(async () => {}),
  resendActivation: vi.fn(async () => 'ok'),
  requestPasswordReset: vi.fn(async () => 'ok'),
  confirmPasswordReset: vi.fn(async () => 'ok'),
  requestAccountDeletion: vi.fn(async () => ({ detail: 'ok', scheduled_deletion_at: new Date().toISOString() })),
  restoreAccount: vi.fn(async () => ({}) as AuthUser),
  switchActiveProject: vi.fn(async () => {}),
};

const projectApiMocks = vi.hoisted(() => ({
  create: vi.fn(async () => ({
    data: {
      id: 2,
      name: 'Beta',
      slug: 'beta',
      description: '',
      is_active: true,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  })),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      create: projectApiMocks.create,
    },
  };
});

vi.mock('../commands/useCommandContext', () => ({
  useCommandContext: () => ({
    openPalette: vi.fn(),
    closePalette: vi.fn(),
    registerCommands: vi.fn(() => () => {}),
    registerCreateActions: vi.fn(() => () => {}),
    setContextTag: vi.fn(),
    currentContextTags: ['global'],
    activeCreateActions: [],
    runPrimaryCreateAction: vi.fn(),
  }),
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
  useRegisterCreateActions: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
    authState.activeProjectId = null;
    authState.switchActiveProject.mockClear();
    projectApiMocks.create.mockClear();
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('renders public home page on root path', async () => {
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByText('OpenFarmPlanner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Impressum' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toBeInTheDocument();
  });

  it('switches the public landing page product tour screenshot by tab', async () => {
    const user = userEvent.setup();

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByRole('tab', { name: 'Flächen' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Flächen',
      'Anbaupläne',
      'Kulturen',
      'Kalender',
      'Erträge',
      'Saatgut',
    ]);
    expect(screen.getByRole('img', {
      name: 'Tabellenansicht der Anbauflächen mit editierbaren Zellen für Standorte, Parzellen und Beete',
    })).toHaveAttribute('src', '/landing/screenshots/demo-areas.webp');

    await user.click(screen.getByRole('tab', { name: 'Saatgut' }));

    expect(screen.getByRole('tab', { name: 'Saatgut' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Saatgutbedarf aus den Plänen ableiten' })).toBeInTheDocument();
    expect(screen.getByRole('img', {
      name: 'Saatgutbedarf-Tabelle mit Kulturen, Lieferanten, benötigter Menge und Packungsvorschlägen',
    })).toHaveAttribute('src', '/landing/screenshots/demo-seed-demand.webp');

    await user.click(screen.getByRole('tab', { name: 'Erträge' }));

    expect(screen.getByRole('tab', { name: 'Erträge' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Erwartete Ernten im Blick behalten' })).toBeInTheDocument();
    expect(screen.getByRole('img', {
      name: 'Ertragsübersicht mit erwarteten Erntemengen nach Kalenderwochen und Kulturen',
    })).toHaveAttribute('src', '/landing/screenshots/demo-yield-overview.webp');
  });

  it('renders imprint route', async () => {
    window.history.pushState({}, '', '/impressum');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByRole('heading', { name: 'Impressum' })).toBeInTheDocument();
  });

  it('renders privacy route', async () => {
    window.history.pushState({}, '', '/datenschutz');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByRole('heading', { name: 'Datenschutzerklärung' })).toBeInTheDocument();
  });

  it('renders navigation for authenticated users in /app', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = null;
    window.history.pushState({}, '', '/app/anbauplaene');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByText('Anbauflächen')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: translations.navigation.locations })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Übersicht' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Zur Übersicht' }).length).toBeGreaterThan(0);
    expect(screen.getByText(translations.navigation.cultures)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translations.navigation.plantingPlans })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aktives Projekt wechseln' })).toBeInTheDocument();
  });

  it('links logo to dashboard when an active project is selected', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: 1,
      last_project_id: 1,
      resolved_project_id: 1,
      needs_project_selection: false,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = 1;
    window.history.pushState({}, '', '/app/locations');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    const logoLinks = await screen.findAllByRole('link', { name: 'Zur Übersicht' });
    expect(logoLinks[0]).toHaveAttribute('href', '/app/dashboard');
  });

  it('shows account settings and project settings in three-dot menu on desktop', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    window.history.pushState({}, '', '/app');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);
    fireEvent.click(await screen.findByLabelText('Mehr'));
    expect(await screen.findByText('Kontoeinstellungen')).toBeInTheDocument();
    expect(screen.getByText('Projekteinstellungen')).toBeInTheDocument();
  });



  it('shows project actions in project switcher menu', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: 1,
      last_project_id: 1,
      resolved_project_id: 1,
      needs_project_selection: false,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = 1;
    window.history.pushState({}, '', '/app/anbauplaene');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aktives Projekt wechseln' }));
    expect(await screen.findByText('Projekteinstellungen')).toBeInTheDocument();
    expect(screen.queryByText('Mitglieder verwalten')).not.toBeInTheDocument();
    expect(await screen.findByText('Neues Projekt')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Neues Projekt'));
    expect(await screen.findByRole('heading', { name: 'Projekt anlegen' })).toBeInTheDocument();
  });

  it('opens project settings from the project switcher menu', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: 1,
      last_project_id: 1,
      resolved_project_id: 1,
      needs_project_selection: false,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = 1;
    window.history.pushState({}, '', '/app/anbauplaene');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aktives Projekt wechseln' }));
    fireEvent.click(await screen.findByText('Projekteinstellungen'));

    expect(window.location.pathname).toBe('/app/project-settings');
  });

  it('opens the create-project dialog from the project switcher for users without projects', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = null;
    window.history.pushState({}, '', '/app/fields-beds');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aktives Projekt wechseln' }));
    fireEvent.click(await screen.findByText('Neues Projekt'));
    expect(await screen.findByRole('heading', { name: 'Projekt anlegen' })).toBeInTheDocument();
  });

  it('creates a project from the dialog with only a project name', async () => {
    const user = userEvent.setup();
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: 1,
      last_project_id: 1,
      resolved_project_id: 1,
      needs_project_selection: false,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = 1;
    window.history.pushState({}, '', '/app/dashboard');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Aktives Projekt wechseln' }));
    fireEvent.click(await screen.findByText('Neues Projekt'));

    const projectNameInput = await screen.findByRole('textbox', { name: 'Projektname' });
    await waitFor(() => expect(projectNameInput).toHaveFocus());
    expect(screen.queryByRole('textbox', { name: 'Beschreibung' })).not.toBeInTheDocument();

    await user.type(projectNameInput, 'Beta{Enter}');

    await waitFor(() => {
      expect(projectApiMocks.create).toHaveBeenCalledWith({
        name: 'Beta',
        description: '',
      });
    });
    expect(authState.switchActiveProject).toHaveBeenCalledWith(2);
  });

  it('does not show cultures load error for users without projects', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = null;
    window.history.pushState({}, '', '/app/cultures');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByRole('heading', { name: 'Kulturen' })).toBeInTheDocument();
    expect(screen.queryByText('Fehler beim Laden der Kulturen')).not.toBeInTheDocument();
  });

  it('does not open supplier creation from query intent for users without projects', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = null;
    window.history.pushState({}, '', '/app/suppliers?create=1');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByRole('heading', { name: 'Lieferanten' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Lieferant anlegen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
  });

  it('navigates from split/detail pages through the sidebar without URL and content diverging', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = null;

    for (const { initialPath, previousHeading } of [
      { initialPath: '/app/cultures', previousHeading: 'Kulturen' },
      { initialPath: '/app/planting-plans', previousHeading: 'Anbaupläne' },
    ]) {
      if (initialPath === '/app/cultures') {
        localStorage.setItem('selectedCultureId', '1');
      }
      window.history.pushState({}, '', initialPath);
      const { unmount } = render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

      await screen.findByText('Anbauflächen');
      const fieldsBedsLink = screen
        .getAllByRole('link', { name: 'Anbauflächen' })
        .find((link) => link.getAttribute('href') === '/app/fields-beds');
      expect(fieldsBedsLink).toBeDefined();
      if (!fieldsBedsLink) {
        throw new Error('Fields and beds sidebar link was not found');
      }
      fireEvent.click(fieldsBedsLink);

      await waitFor(() => {
        expect(window.location.pathname).toBe('/app/fields-beds');
      }, { timeout: 3000 });
      expect(await screen.findByRole('heading', { name: 'Anbauflächen' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: previousHeading })).not.toBeInTheDocument();

      unmount();
      localStorage.clear();
    }
  });


  it('resolves basename only when current path matches configured base', () => {
    expect(resolveRouterBasename('/openfarmplanner', '/openfarmplanner/invite/abc')).toBe('/openfarmplanner');
    expect(resolveRouterBasename('/openfarmplanner', '/invite/abc')).toBe('');
  });

  it('redirects unauthenticated users from /app to login', async () => {
    window.history.pushState({}, '', '/app');
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument();
  });

  it('redirects authenticated users from unknown /app/* routes to dashboard (BUG-M01 regression guard)', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };
    authState.activeProjectId = null;
    window.history.pushState({}, '', '/app/this-does-not-exist');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    await screen.findByText('Anbauflächen');
    expect(window.location.pathname).toBe('/app/dashboard');
  });

  it('redirects unknown top-level routes to home', async () => {
    window.history.pushState({}, '', '/this-page-does-not-exist');

    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    expect(await screen.findByText('OpenFarmPlanner')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
