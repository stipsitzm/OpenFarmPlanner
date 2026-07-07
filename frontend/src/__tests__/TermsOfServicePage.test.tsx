import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TermsOfServicePage from '../pages/public/TermsOfServicePage';

function renderTermsOfServicePage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <TermsOfServicePage />
    </MemoryRouter>,
  );
}

describe('TermsOfServicePage', () => {
  it('renders the heading and every section with resolved (non-key) titles', () => {
    renderTermsOfServicePage();

    expect(screen.getByRole('heading', { level: 1, name: 'Nutzungsbedingungen' })).toBeInTheDocument();

    const sectionHeadings = screen.getAllByRole('heading', { level: 6 });
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(13);
    for (const heading of sectionHeadings) {
      expect(heading.textContent).not.toMatch(/legal\.terms\.sections/);
    }
  });

  it('links to the privacy policy and back again from the privacy policy', async () => {
    renderTermsOfServicePage();

    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/datenschutz');
  });

  it('covers liability, addressing availability, user content, and agricultural-data disclaimers', () => {
    renderTermsOfServicePage();

    expect(screen.getByRole('heading', { name: /Haftung/ })).toBeInTheDocument();
    expect(screen.getByText(/grober Fahrlässigkeit/)).toBeInTheDocument();
    expect(screen.getByText(/§ 6 Abs\. 1 Z 9 Konsumentenschutzgesetz/)).toBeInTheDocument();
    expect(screen.getByText(/keine agronomische oder pflanzenschutzrechtliche Beratung/)).toBeInTheDocument();
  });

  it('mentions the AGPLv3 open-source license', () => {
    renderTermsOfServicePage();

    expect(screen.getByText(/GNU Affero General Public License/)).toBeInTheDocument();
  });

  it('uses a concrete revision date instead of a generic month/year stamp', () => {
    renderTermsOfServicePage();

    expect(screen.getByText(/Stand: 7\. Juli 2026/)).toBeInTheDocument();
  });
});
