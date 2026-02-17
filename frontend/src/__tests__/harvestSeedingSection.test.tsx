import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HarvestSection } from '../cultures/sections/HarvestSection';
import { SeedingSection } from '../cultures/sections/SeedingSection';

const t = (key: string, options?: Record<string, unknown>) =>
  typeof options?.defaultValue === 'string' ? options.defaultValue : key;

describe('HarvestSection and SeedingSection', () => {
  it('changes harvest method via select', () => {
    const onChange = vi.fn();

    render(
      <HarvestSection
        formData={{ harvest_method: '' }}
        errors={{ harvest_method: 'required' }}
        onChange={onChange}
        t={t}
      />
    );

    const harvestCombobox = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(harvestCombobox);
    fireEvent.click(screen.getByRole('option', { name: 'form.harvestMethodPerPlant' }));

    expect(onChange).toHaveBeenCalledWith('harvest_method', 'per_plant');
    expect(screen.getByText('form.harvestMethodRequired')).toBeInTheDocument();
  });

  it('handles seeding unit select and blur callbacks', () => {
    const onChange = vi.fn();

    render(
      <SeedingSection
        formData={{ seed_rate_unit: 'g_per_m2', seed_rate_value: 3 }}
        errors={{ seed_rate_value: 'invalid' }}
        onChange={onChange}
        t={t}
      />
    );

    const amountInput = screen.getByLabelText('Menge');
    fireEvent.blur(amountInput);
    expect(onChange).toHaveBeenCalledWith('seed_rate_value', 3);

    const unitCombobox = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(unitCombobox);
    fireEvent.click(screen.getByRole('option', { name: 'Korn / lfm' }));
    expect(onChange).toHaveBeenCalledWith('seed_rate_unit', 'seeds/m');

    fireEvent.blur(unitCombobox);
    expect(onChange).toHaveBeenCalledWith('seed_rate_unit', 'g_per_m2');

    expect(screen.getByText('invalid')).toBeInTheDocument();
  });
});
