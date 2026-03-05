import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CultureDetail } from '../cultures/CultureDetail';
import type { Culture } from '../api/api';
import translations from '@/test-utils/translations';

describe('CultureDetail Component', () => {
  const mockCultures: Culture[] = [
    {
      id: 1,
      name: 'Tomato',
      variety: 'Cherry',

      growth_duration_days: 56,
      harvest_duration_days: 28,
      notes: 'Frisch und süß.',
    },
    {
      id: 2,
      name: 'Lettuce',

      growth_duration_days: 42,
      harvest_duration_days: 14,
    },
    {
      id: 3,
      name: 'Asparagus',

      growth_duration_days: 730,
      harvest_duration_days: 56,
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
    
    expect(screen.getByText('Tomato')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
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
    
    expect(screen.getByText(/56\s+Tage/)).toBeInTheDocument();
    expect(screen.getByText(/28\s+Tage/)).toBeInTheDocument();
  });


  it('displays sowing depth with one decimal place', () => {
    const mockOnSelect = vi.fn();
    const culturesWithDepth: Culture[] = [
      {
        id: 10,
        name: 'Karotte',
        variety: 'Nantaise',
        sowing_depth_cm: 2,
      },
    ];

    render(
      <CultureDetail
        cultures={culturesWithDepth}
        selectedCultureId={10}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('2.0 cm')).toBeInTheDocument();
  });

  it('displays notes when available', () => {
    const mockOnSelect = vi.fn();
    render(
      <CultureDetail
        cultures={mockCultures}
        selectedCultureId={1}
        onCultureSelect={mockOnSelect}
      />
    );
    
    expect(screen.getByText('Frisch und süß.')).toBeInTheDocument();
  });

  it('shows cultivation chips and per-method seed-rate table', () => {
    const mockOnSelect = vi.fn();
    const cultures: Culture[] = [
      {
        id: 11,
        name: 'Möhre',
        cultivation_types: ['pre_cultivation', 'direct_sowing'],
        seed_rate_by_cultivation: {
          pre_cultivation: { value: 2, unit: 'seeds_per_plant' },
          direct_sowing: { value: 50, unit: 'seeds/m' },
        },
      },
    ];

    render(
      <CultureDetail
        cultures={cultures}
        selectedCultureId={11}
        onCultureSelect={mockOnSelect}
      />
    );

    expect(screen.getAllByText('Pflanzung').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Direktsaat').length).toBeGreaterThan(0);
    expect(screen.getByText('Saatgutmenge nach Anbauart')).toBeInTheDocument();
    expect(screen.getByText('Korn / Pflanze')).toBeInTheDocument();
    expect(screen.getByText('Korn / lfm')).toBeInTheDocument();
  });

});
