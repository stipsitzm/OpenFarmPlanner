import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CultureDetail } from '../components/CultureDetail';
import type { Culture } from '../api/client';

describe('CultureDetail Component', () => {
  const mockCultures: Culture[] = [
    {
      id: 1,
      name: 'Tomato',
      variety: 'Cherry',
      days_to_harvest: 60,
      perennial: false,
      median_days_to_first_harvest: 55,
      median_days_to_last_harvest: 85,
      median_lifespan: 120,
      en_wikipedia_url: 'https://en.wikipedia.org/wiki/Tomato',
    },
    {
      id: 2,
      name: 'Lettuce',
      days_to_harvest: 45,
      perennial: false,
      median_days_to_first_harvest: 40,
      median_days_to_last_harvest: 50,
    },
    {
      id: 3,
      name: 'Asparagus',
      days_to_harvest: 730,
      perennial: true,
      median_lifespan: 7300,
    },
  ];

  it('renders search field', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByLabelText('Kultur suchen')).toBeInTheDocument();
  });

  it('displays empty state when no culture is selected', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('Wählen Sie eine Kultur aus der Liste aus, um Details anzuzeigen.')).toBeInTheDocument();
  });

  it('displays culture details when culture is selected', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('Tomato (Cherry)')).toBeInTheDocument();
    expect(screen.getByText('Einjährig')).toBeInTheDocument();
    expect(screen.getByText('Wachstum & Ernte')).toBeInTheDocument();
  });

  it('displays perennial badge for perennial crops', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={3}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('Mehrjährig')).toBeInTheDocument();
  });

  it('displays harvest information correctly', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('55–85 Tage nach der Aussaat')).toBeInTheDocument();
    expect(screen.getByText('120 Tage')).toBeInTheDocument();
  });

  it('displays Wikipedia link when available', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    const link = screen.getByText('Mehr Infos (Wikipedia)');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Tomato');
  });

  it('displays "Keine Angabe" for missing values', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={3}
        onCultureSelect={mockOnSelect}
      />
    );
    
    const noDataElements = screen.getAllByText('Keine Angabe');
    expect(noDataElements.length).toBeGreaterThan(0);
  });
});
