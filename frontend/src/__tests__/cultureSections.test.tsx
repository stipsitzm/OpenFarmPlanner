import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorSection } from '../cultures/sections/ColorSection';
import { NotesSection } from '../cultures/sections/NotesSection';
import { SpacingSection } from '../cultures/sections/SpacingSection';
import { SeedingSection } from '../cultures/sections/SeedingSection';
import { HarvestSection } from '../cultures/sections/HarvestSection';

const t = (key: string, options?: Record<string, unknown>) => {
  if (typeof options?.defaultValue === 'string') {
    return options.defaultValue;
  }
  return key;
};

describe('culture form UI sections', () => {
  it('renders ColorSection with default color and emits display color changes', () => {
    const onChange = vi.fn();

    render(
      <ColorSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
        defaultColor="#00ff00"
      />
    );

    const colorInput = screen.getByLabelText('form.displayColor');
    expect(colorInput).toHaveValue('#00ff00');

    fireEvent.change(colorInput, { target: { value: '#123456' } });

    expect(onChange).toHaveBeenCalledWith('display_color', '#123456');
    expect(screen.getByText('form.displayColorHelp')).toBeInTheDocument();
  });

  it('renders NotesSection and emits note changes', () => {
    const onChange = vi.fn();

    render(
      <NotesSection
        formData={{ notes: 'Bestehende Notiz' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    const notesInput = screen.getByLabelText('form.notes');
    expect(notesInput).toHaveValue('Bestehende Notiz');

    fireEvent.change(notesInput, { target: { value: 'Neue Notiz' } });

    expect(onChange).toHaveBeenCalledWith('notes', 'Neue Notiz');
  });

  it('renders SpacingSection and parses numeric inputs', () => {
    const onChange = vi.fn();

    render(
      <SpacingSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByLabelText('Abstand in der Reihe (cm)'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Reihenabstand (cm)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Saattiefe (cm)'), { target: { value: '2' } });

    expect(onChange).toHaveBeenCalledWith('distance_within_row_cm', 25);
    expect(onChange).toHaveBeenCalledWith('row_spacing_cm', 40);
    expect(onChange).toHaveBeenCalledWith('sowing_depth_cm', 2);

  });

  it('renders SeedingSection and handles seed value and safety percent changes', () => {
    const onChange = vi.fn();

    render(
      <SeedingSection
        formData={{ seed_rate_value: 5, seed_rate_unit: 'seeds/m' }}
        errors={{ seed_rate_unit: 'Bitte wählen' }}
        onChange={onChange}
        t={t}
      />
    );

    const amountInput = screen.getByLabelText('Menge');
    fireEvent.change(amountInput, { target: { value: '12.5' } });
    expect(onChange).toHaveBeenCalledWith('seed_rate_value', 12.5);

    const safetyInput = screen.getByLabelText('Sicherheitszuschlag für Saatgut (%)');
    fireEvent.change(safetyInput, { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith('sowing_calculation_safety_percent', 10);

    expect(screen.getByText('Bitte wählen')).toBeInTheDocument();
  });

  it('renders HarvestSection and parses expected yield input including empty value', () => {
    const onChange = vi.fn();

    render(
      <HarvestSection
        formData={{ expected_yield: 3.5 }}
        errors={{ expected_yield: 'Ungültig' }}
        onChange={onChange}
        t={t}
      />
    );

    const yieldInput = screen.getByLabelText('form.expectedYield');
    expect(yieldInput).toHaveValue(3.5);

    fireEvent.change(yieldInput, { target: { value: '4.25' } });
    expect(onChange).toHaveBeenCalledWith('expected_yield', 4.25);

    fireEvent.change(yieldInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('expected_yield', undefined);
    expect(screen.getByText('Ungültig')).toBeInTheDocument();
  });
});
