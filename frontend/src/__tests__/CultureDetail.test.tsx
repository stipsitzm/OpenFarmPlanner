import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CultureDetail } from '../components/CultureDetail';
import type { Culture } from '../api/api';
import translations from '@/test-utils/translations';

describe('CultureDetail Component', () => {
  const mockCultures: Culture[] = [
    {
      id: 1,
      name: 'Tomato',
      variety: 'Cherry',
      days_to_harvest: 60,
      growth_duration_days: 56,
      harvest_duration_days: 28,
      perennial: false,
      median_lifespan: 120,
      en_wikipedia_url: 'https://en.wikipedia.org/wiki/Tomato',
    },
    {
      id: 2,
      name: 'Lettuce',
      days_to_harvest: 45,
      growth_duration_days: 42,
      harvest_duration_days: 14,
      perennial: false,
    },
    {
      id: 3,
      name: 'Asparagus',
      days_to_harvest: 730,
      growth_duration_days: 730,
      harvest_duration_days: 56,
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
    
    expect(screen.getByLabelText(translations.cultures.searchPlaceholder)).toBeInTheDocument();
  });

  it('displays empty state when no culture is selected', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText(translations.cultures.selectPrompt)).toBeInTheDocument();
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
    expect(screen.getByText(translations.cultures.annual)).toBeInTheDocument();
    expect(screen.getByText(translations.cultures.sections.growthHarvest)).toBeInTheDocument();
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
    
    expect(screen.getByText(translations.cultures.perennial)).toBeInTheDocument();
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
    
    const link = screen.getByText(translations.cultures.moreInfo);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Tomato');
  });

  it('displays Growstuff attribution for Growstuff-sourced crops', () => {
    const mockOnSelect = vi.fn();
    const growstuffCulture: Culture = {
      ...mockCultures[0],
      source: 'growstuff',
    };
    
    render(
      <CultureDetail
        cultures={[growstuffCulture]}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText(new RegExp(translations.cultures.attribution))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(translations.cultures.attributionLink))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(translations.cultures.license))).toBeInTheDocument();
  });

  it('does not display Growstuff attribution for manual crops', () => {
    const mockOnSelect = vi.fn();
    const manualCulture: Culture = {
      ...mockCultures[0],
      source: 'manual',
    };
    
    render(
      <CultureDetail
        cultures={[manualCulture]}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.queryByText(new RegExp(translations.cultures.attribution))).not.toBeInTheDocument();
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
    
    const noDataElements = screen.getAllByText(translations.cultures.noData);
    expect(noDataElements.length).toBeGreaterThan(0);
  });
});
