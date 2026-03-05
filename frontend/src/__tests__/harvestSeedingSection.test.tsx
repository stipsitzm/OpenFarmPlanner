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
    fireEvent.click(screen.getByRole('option', { name: 'g / lfm' }));
    expect(onChange).toHaveBeenCalledWith('seed_rate_unit', 'g_per_lfm');

    fireEvent.blur(unitCombobox);
    expect(onChange).toHaveBeenCalledWith('seed_rate_unit', 'g_per_m2');

    expect(screen.getByText('invalid')).toBeInTheDocument();
  });

  it('shows Anzucht label with unit and hides unit select when only pre_cultivation is selected', () => {
    const onChange = vi.fn();

    render(
      <SeedingSection
        formData={{ cultivation_types: ['pre_cultivation'], seed_rate_unit: 'seeds_per_plant', seed_rate_value: 2 }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    expect(screen.getByLabelText('Anzucht Menge (Korn / Pflanze)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Einheit')).not.toBeInTheDocument();
  });

  it('shows method-specific fields when both cultivation methods are selected', () => {
    const onChange = vi.fn();

    render(
      <SeedingSection
        formData={{ cultivation_types: ['pre_cultivation', 'direct_sowing'], seed_rate_by_cultivation: null }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    expect(screen.getByLabelText('Anzucht Menge (Korn / Pflanze)')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Direktsaat Menge')).toBeInTheDocument();
  });
});
