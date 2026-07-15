import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPolicyPage from '../pages/public/PrivacyPolicyPage';

function renderPrivacyPolicyPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <PrivacyPolicyPage />
    </MemoryRouter>,
  );
}

describe('PrivacyPolicyPage', () => {
  it('renders the heading and every section with resolved (non-key) titles', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeInTheDocument();

    const sectionHeadings = screen.getAllByRole('heading', { level: 6 });
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(15);
    for (const heading of sectionHeadings) {
      expect(heading.textContent).not.toMatch(/legal\.privacy\.sections/);
    }
  });

  it('no longer mentions the AI enrichment feature or OpenAI', () => {
    renderPrivacyPolicyPage();

    expect(screen.queryByText(/KI-gestützte Datenanreicherung/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OpenAI/)).not.toBeInTheDocument();
  });

  it('covers the public library section with resolved content', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByRole('heading', { name: /Öffentliche Kulturbibliothek/ })).toBeInTheDocument();
    expect(screen.getByText(/derzeit nicht möglich/)).toBeInTheDocument();
  });

  it('states that public attribution uses an opt-in public display name, never the email address', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByText(/öffentliche Anzeigename angezeigt/)).toBeInTheDocument();
    expect(screen.getByText(/erfolgt die Veröffentlichung anonym/)).toBeInTheDocument();
    expect(screen.getByText(/zu keinem Zeitpunkt Bestandteil eines öffentlichen Eintrags/)).toBeInTheDocument();
  });

  it('explains that the display name belongs to the account and applies retroactively, and must be unique', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByText(/gehört zu Ihrem Konto, nicht zum einzelnen Eintrag/)).toBeInTheDocument();
    expect(screen.getByText(/Frühere Namen werden dabei nicht an einzelnen Einträgen gespeichert/)).toBeInTheDocument();
    expect(screen.getByText(/Der Anzeigename muss eindeutig sein/)).toBeInTheDocument();
  });

  it('mentions a general, forward-looking note on future collaboration without describing features that do not exist yet', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByText(/kollaborativ weiterentwickelt werden/)).toBeInTheDocument();
    expect(screen.getByText(/nicht über persönliche Kontaktdaten anderer Nutzer/)).toBeInTheDocument();
  });

  it('bases the public library section solely on consent (Art. 6 Abs. 1 lit. a)', () => {
    renderPrivacyPolicyPage();

    const legalBasisLines = screen.getAllByText(/Rechtsgrundlage:/);
    const publicLibraryBasis = legalBasisLines.find((el) => el.textContent?.includes('lit. a'));
    expect(publicLibraryBasis).toBeDefined();
    expect(publicLibraryBasis?.textContent).not.toMatch(/lit\. f/);
  });

  it('separates cookies from local/session storage into distinct sections', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByRole('heading', { name: /^\d+\. Cookies$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lokaler Speicher/ })).toBeInTheDocument();
    expect(screen.getByText(/keine Analyse-, Tracking- oder Marketing-Cookies/)).toBeInTheDocument();
    expect(screen.getByText(/zuletzt geöffnete Projekt/)).toBeInTheDocument();
    expect(screen.getByText(/Session-Storage-Daten werden in der Regel beim Schließen des Browser-Tabs gelöscht/)).toBeInTheDocument();
  });

  it('does not claim data is never shared with third parties', () => {
    renderPrivacyPolicyPage();

    expect(screen.queryByText(/werden nicht an Dritte weitergegeben/)).not.toBeInTheDocument();
    expect(screen.getByText(/Auftragsverarbeitung/)).toBeInTheDocument();
  });

  it('lists the right to withdraw consent and cites GDPR article numbers', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByText(/Widerruf einer erteilten Einwilligung/)).toBeInTheDocument();
    expect(screen.getByText(/Art\. 15 DSGVO/)).toBeInTheDocument();
    expect(screen.getByText(/Art\. 7 Abs\. 3 DSGVO/)).toBeInTheDocument();
  });

  it('covers WKO checklist details for provision duty, third-country transfer, and profiling', () => {
    renderPrivacyPolicyPage();

    expect(screen.queryByRole('heading', { name: /Datenschutzbeauftragter/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/kein Datenschutzbeauftragter bestellt/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Bereitstellung personenbezogener Daten/ })).toBeInTheDocument();
    expect(screen.getByText(/ohne diese Daten können wir kein Benutzerkonto bereitstellen/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Drittlandübermittlung/ })).toBeInTheDocument();
    expect(screen.getByText(/außerhalb der Europäischen Union oder des Europäischen Wirtschaftsraums findet/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Automatisierte Entscheidungsfindung/ })).toBeInTheDocument();
    expect(screen.getByText(/einschließlich Profiling im Sinne des Art\. 22 DSGVO/)).toBeInTheDocument();
  });

  it('states concrete retention windows visible from account and invitation flows', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByText(/Aktivierungslinks sind derzeit 7 Tage gültig/)).toBeInTheDocument();
    expect(screen.getByText(/E-Mail-Änderungslinks sind derzeit 24 Stunden gültig/)).toBeInTheDocument();
    expect(screen.getByText(/Projekt-Einladungen sind derzeit 14 Tage gültig/)).toBeInTheDocument();
    expect(screen.getByText(/für 14 Tage als „zur Löschung vorgemerkt“/)).toBeInTheDocument();
    expect(screen.getByText(/Server-Logfiles des Hosting-Anbieters werden täglich rotiert und nach 7 Tagen gelöscht/)).toBeInTheDocument();
    expect(screen.getByText(/Eigene technische Cron- und Anwendungslogs speichern wir höchstens 14 Tage/)).toBeInTheDocument();
  });

  it('uses a concrete revision date instead of a generic month/year stamp', () => {
    renderPrivacyPolicyPage();

    expect(screen.getByText(/Stand: 14\. Juli 2026/)).toBeInTheDocument();
  });
});
