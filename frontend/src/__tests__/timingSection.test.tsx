import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimingSection } from '../cultures/sections/TimingSection';

const t = (key: string) => key;

describe('TimingSection', () => {
  it('parses growth and harvest duration inputs', () => {
    const onChange = vi.fn();

    render(
      <TimingSection
        formData={{ cultivation_type: 'pre_cultivation' }}
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

  it('uses fallback values and direct sowing behavior', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <TimingSection
        formData={{ cultivation_type: 'pre_cultivation', growth_duration_days: 20, harvest_duration_days: 7, propagation_duration_days: 30 }}
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
        formData={{ cultivation_type: 'direct_sowing' }}
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
        formData={{ cultivation_type: 'pre_cultivation' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Anbauart' }));
    fireEvent.click(screen.getByRole('option', { name: 'Direktsaat' }));

    expect(onChange).toHaveBeenCalledWith('cultivation_type', 'direct_sowing');
    expect(onChange).toHaveBeenCalledWith('propagation_duration_days', 0);
  });

});
