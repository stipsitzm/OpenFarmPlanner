import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ConsentGate from '../auth/ConsentGate';

const acceptConsentMock = vi.fn(async () => undefined);
const logoutMock = vi.fn(async () => undefined);
let authUser: unknown = {
  id: 1,
  email: 'test@example.com',
  pending_consents: ['terms'],
};

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: authUser,
    acceptConsent: acceptConsentMock,
    logout: logoutMock,
  }),
}));

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'reconsent.accepting': 'Wird bestätigt…',
        'reconsent.logout': 'Abmelden',
        'reconsent.failed': 'Das hat leider nicht funktioniert. Bitte versuche es erneut.',
        'reconsent.terms.title': 'Wir haben unsere Nutzungsbedingungen aktualisiert',
        'reconsent.terms.body': 'Damit du OpenFarmPlanner weiter nutzen kannst, bestätige bitte die aktuelle Fassung der Nutzungsbedingungen.',
        'reconsent.terms.linkLabel': 'Nutzungsbedingungen ansehen',
        'reconsent.terms.acceptButton': 'Nutzungsbedingungen akzeptieren',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('ConsentGate', () => {
  beforeEach(() => {
    acceptConsentMock.mockClear();
    logoutMock.mockClear();
    authUser = {
      id: 1,
      email: 'test@example.com',
      pending_consents: ['terms'],
    };
  });

  it('explains that the terms changed, links to the full text, and offers an accept button (no checkbox)', () => {
    render(
      <MemoryRouter>
        <ConsentGate />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Wir haben unsere Nutzungsbedingungen aktualisiert' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nutzungsbedingungen ansehen' })).toHaveAttribute('href', '/nutzungsbedingungen');
    expect(screen.getByRole('button', { name: 'Nutzungsbedingungen akzeptieren' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('moves focus to the heading on mount so screen readers announce the page', () => {
    render(
      <MemoryRouter>
        <ConsentGate />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Wir haben unsere Nutzungsbedingungen aktualisiert' })).toHaveFocus();
  });

  it('accepts the current terms version with a single click, no checkbox required', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConsentGate />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Nutzungsbedingungen akzeptieren' }));

    expect(acceptConsentMock).toHaveBeenCalledWith('terms');
  });

  it('is fully keyboard-operable: tab reaches the accept and logout buttons', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConsentGate />
      </MemoryRouter>,
    );

    await user.tab();
    expect(screen.getByRole('link', { name: 'Nutzungsbedingungen ansehen' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Nutzungsbedingungen akzeptieren' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(acceptConsentMock).toHaveBeenCalledWith('terms');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toHaveFocus();
  });

  it('offers a logout option instead of trapping the user', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConsentGate />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('shows an error message when accepting fails', async () => {
    acceptConsentMock.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ConsentGate />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Nutzungsbedingungen akzeptieren' }));

    expect(await screen.findByText('Netzwerkfehler')).toBeInTheDocument();
  });

  it('renders nothing when there are no pending consents', () => {
    authUser = { id: 1, email: 'test@example.com', pending_consents: [] };

    const { container } = render(
      <MemoryRouter>
        <ConsentGate />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
