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
        formData={{ cultivation_types: ['direct_sowing'], seed_rate_direct_unit: 'g_per_m2', seed_rate_direct_value: 3 }}
        errors={{ seed_rate_direct_value: 'invalid' }}
        onChange={onChange}
        t={t}
      />
    );

    const amountInput = screen.getByLabelText('Menge');
    fireEvent.change(amountInput, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('seed_rate_direct_value', 4);

    const unitCombobox = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(unitCombobox);
    fireEvent.click(screen.getByRole('option', { name: 'g / lfm' }));
    expect(onChange).toHaveBeenCalledWith('seed_rate_direct_unit', 'g_per_lfm');
    
    expect(screen.getByText('invalid')).toBeInTheDocument();
  });

});
