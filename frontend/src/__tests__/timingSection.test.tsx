import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimingSection } from '../cultures/sections/TimingSection';

const translations: Record<string, string> = {
  'form.cultivationType': 'Anbauart',
  'form.cultivationTypeDirectSowing': 'Direktsaat',
  'form.cultivationTypePreCultivation': 'Pflanzung',
  'form.growthDurationDays': 'Wachstumszeit (Tage)',
  'form.growthDurationDaysHelp': 'Zeit vom Pflanzdatum bis zum Erntebeginn.',
  'form.harvestDurationDays': 'Erntezeit (Tage)',
  'form.harvestDurationDaysHelp': 'Zeit vom Erntebeginn bis zum Ernteende.',
  'form.propagationDurationDays': 'Anzuchtdauer (Tage)',
  'form.propagationDurationDaysHelp': 'Zeit vom Beginn der Anzucht bis zum Pflanzdatum.',
};

const t = (key: string) => translations[key] ?? key;

describe('TimingSection', () => {
  it('parses growth and harvest duration inputs', () => {
    const onChange = vi.fn();

    render(
      <TimingSection
        formData={{ cultivation_type: 'pre_cultivation', cultivation_types: ['pre_cultivation'] }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('form.growthDurationDaysPlaceholder'), { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText('form.harvestDurationDaysPlaceholder'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(/Anzuchtdauer \(Tage\)/), { target: { value: '8' } });

    expect(onChange).toHaveBeenCalledWith('growth_duration_days', 30);
    expect(onChange).toHaveBeenCalledWith('harvest_duration_days', 12);
    expect(onChange).toHaveBeenCalledWith('propagation_duration_days', 8);
  });

  it('explains each timing field using the dates used by the calculation', async () => {
    const user = userEvent.setup();
    render(
      <TimingSection
        formData={{ cultivation_type: 'pre_cultivation', cultivation_types: ['pre_cultivation'] }}
        errors={{}}
        onChange={vi.fn()}
        t={t}
      />
    );

    const assertions = [
      ['Wachstumszeit (Tage)', 'Zeit vom Pflanzdatum bis zum Erntebeginn.'],
      ['Erntezeit (Tage)', 'Zeit vom Erntebeginn bis zum Ernteende.'],
      ['Anzuchtdauer (Tage)', 'Zeit vom Beginn der Anzucht bis zum Pflanzdatum.'],
    ] as const;

    for (const [label, explanation] of assertions) {
      const field = screen.getByLabelText(label);
      await user.hover(field);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(explanation);
      await user.unhover(field);
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    }
  });

  it('uses fallback values and direct sowing behavior', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <TimingSection
        formData={{ cultivation_type: 'pre_cultivation', cultivation_types: ['pre_cultivation'], growth_duration_days: 20, harvest_duration_days: 7, propagation_duration_days: 30 }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    expect(screen.getByText('form.propagationDurationDaysTooLong')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('form.growthDurationDaysPlaceholder'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('form.harvestDurationDaysPlaceholder'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Anzuchtdauer \(Tage\)/), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith('growth_duration_days', 0);
    expect(onChange).toHaveBeenCalledWith('harvest_duration_days', 0);
    expect(onChange).toHaveBeenCalledWith('propagation_duration_days', undefined);

    rerender(
      <TimingSection
        formData={{ cultivation_type: 'direct_sowing', cultivation_types: ['direct_sowing'] }}
        errors={{ propagation_duration_days: 'Fehler' }}
        onChange={onChange}
        t={t}
      />
    );

    const propagationField = screen.getByLabelText(/Anzuchtdauer \(Tage\)/);
    expect(propagationField).toBeDisabled();
    expect(screen.getByText('Fehler')).toBeInTheDocument();
  });


  it('sets propagation duration to 0 when cultivation type changes to direct sowing', () => {
    const onChange = vi.fn();

    render(
      <TimingSection
        formData={{ cultivation_type: 'pre_cultivation', cultivation_types: ['pre_cultivation'] }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Anbauart' }));
    fireEvent.click(screen.getByRole('option', { name: 'Direktsaat' }));

    expect(onChange).toHaveBeenCalledWith('cultivation_types', ['pre_cultivation', 'direct_sowing']);
    expect(onChange).toHaveBeenCalledWith('cultivation_type', 'pre_cultivation');
    expect(onChange).not.toHaveBeenCalledWith('propagation_duration_days', 0);
  });

});
