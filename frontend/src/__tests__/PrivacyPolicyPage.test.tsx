import { render, screen } from '@testing-library/react';
import PrivacyPolicyPage from '../pages/public/PrivacyPolicyPage';

describe('PrivacyPolicyPage', () => {
  it('renders the heading and every section with resolved (non-key) titles', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeInTheDocument();

    const sectionHeadings = screen.getAllByRole('heading', { level: 6 });
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(15);
    for (const heading of sectionHeadings) {
      expect(heading.textContent).not.toMatch(/legal\.privacy\.sections/);
    }
  });

  it('covers the public library and AI enrichment sections with resolved content', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { name: /Öffentliche Kulturbibliothek/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /KI-gestützte Datenanreicherung für Kulturen/ })).toBeInTheDocument();
    expect(screen.getAllByText(/OpenAI/).length).toBeGreaterThan(0);
    expect(screen.getByText(/derzeit nicht möglich/)).toBeInTheDocument();
  });

  it('states that public attribution uses a username, never the email address', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/öffentlicher Benutzername angezeigt/)).toBeInTheDocument();
    expect(screen.getByText(/E-Mail-Adresse wird niemals angezeigt/)).toBeInTheDocument();
    expect(screen.getByText(/nicht Ihre E-Mail-Adresse/)).toBeInTheDocument();
  });

  it('mentions a general, forward-looking note on future collaboration without describing features that do not exist yet', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/kollaborativ weiterentwickelt werden/)).toBeInTheDocument();
    expect(screen.getByText(/nicht über persönliche Kontaktdaten anderer Nutzer/)).toBeInTheDocument();
  });
});
