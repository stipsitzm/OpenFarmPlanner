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
    
    expect(screen.getByText('Tomato (Cherry)')).toBeInTheDocument();
    expect(screen.getByText(translations.cultures.sections.growthHarvest)).toBeInTheDocument();
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
    
    expect(screen.getByText('56 Tage')).toBeInTheDocument();
    expect(screen.getByText('28 Tage')).toBeInTheDocument();
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

});
