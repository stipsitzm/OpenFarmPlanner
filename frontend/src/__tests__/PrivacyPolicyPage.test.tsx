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

  it('no longer mentions the AI enrichment feature or OpenAI', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.queryByText(/KI-gestützte Datenanreicherung/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OpenAI/)).not.toBeInTheDocument();
  });

  it('covers the public library section with resolved content', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { name: /Öffentliche Kulturbibliothek/ })).toBeInTheDocument();
    expect(screen.getByText(/derzeit nicht möglich/)).toBeInTheDocument();
  });

  it('states that public attribution uses a username, never the email address', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/öffentlicher Benutzername angezeigt/)).toBeInTheDocument();
    expect(screen.getByText(/zu keinem Zeitpunkt Bestandteil eines öffentlichen Eintrags/)).toBeInTheDocument();
  });

  it('mentions a general, forward-looking note on future collaboration without describing features that do not exist yet', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/kollaborativ weiterentwickelt werden/)).toBeInTheDocument();
    expect(screen.getByText(/nicht über persönliche Kontaktdaten anderer Nutzer/)).toBeInTheDocument();
  });

  it('bases the public library section solely on consent (Art. 6 Abs. 1 lit. a)', () => {
    render(<PrivacyPolicyPage />);

    const legalBasisLines = screen.getAllByText(/Rechtsgrundlage:/);
    const publicLibraryBasis = legalBasisLines.find((el) => el.textContent?.includes('lit. a'));
    expect(publicLibraryBasis).toBeDefined();
    expect(publicLibraryBasis?.textContent).not.toMatch(/lit\. f/);
  });

  it('separates cookies from local/session storage into distinct sections', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { name: /^\d+\. Cookies$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lokaler Speicher/ })).toBeInTheDocument();
    expect(screen.getByText(/keine Analyse-, Tracking- oder Marketing-Cookies/)).toBeInTheDocument();
  });

  it('does not claim data is never shared with third parties', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.queryByText(/werden nicht an Dritte weitergegeben/)).not.toBeInTheDocument();
    expect(screen.getByText(/Auftragsverarbeitung/)).toBeInTheDocument();
  });

  it('lists the right to withdraw consent and cites GDPR article numbers', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/Widerruf einer erteilten Einwilligung/)).toBeInTheDocument();
    expect(screen.getByText(/Art\. 15 DSGVO/)).toBeInTheDocument();
    expect(screen.getByText(/Art\. 7 Abs\. 3 DSGVO/)).toBeInTheDocument();
  });

  it('uses a concrete revision date instead of a generic month/year stamp', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/Stand: 7\. Juli 2026/)).toBeInTheDocument();
  });
});
