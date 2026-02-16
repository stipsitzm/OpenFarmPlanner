import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CultureForm } from '../cultures/CultureForm';
import type { Culture } from '../api/types';

const existingCulture: Culture = {
  id: 11,
  name: 'Karotte',
  growth_duration_days: 70,
  harvest_duration_days: 20,
  propagation_duration_days: 14,
  cultivation_type: 'pre_cultivation',
  nutrient_demand: 'medium',
  notes: '',
};

describe('CultureForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates required fields on submit and blocks saving invalid form data', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Erstellen' }).closest('form')!);

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText('Name ist erforderlich')).toBeInTheDocument();
    expect(screen.getByText('Wachstumszeitraum ist erforderlich')).toBeInTheDocument();
    expect(screen.getByText('Erntezeitraum ist erforderlich')).toBeInTheDocument();
  });

  it('submits edited data and shows a success confirmation snackbar', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={existingCulture} onSave={onSave} onCancel={vi.fn()} />);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Karotte Früh');

    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 11,
          name: 'Karotte Früh',
          growth_duration_days: 70,
          harvest_duration_days: 20,
          propagation_duration_days: 14,
        })
      );
    });

    expect(await screen.findByText('Kultur erfolgreich aktualisiert')).toBeInTheDocument();
  });

  it('shows a translated save error message when the save request fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));

    render(<CultureForm culture={existingCulture} onSave={onSave} onCancel={vi.fn()} />);

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Karotte Fehlversuch');

    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Fehler beim Aktualisieren der Kultur')).toBeInTheDocument();
  });

  it('clears unit when seed amount is removed to keep seed-rate fields consistent', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <CultureForm
        culture={{ ...existingCulture, seed_rate_value: 5, seed_rate_unit: 'g_per_m2' }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText('Menge');
    await user.clear(amountInput);
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          seed_rate_value: null,
          seed_rate_unit: null,
        })
      );
    });

    expect(screen.queryByText('Wenn eine Einheit gewählt wird, muss auch eine Menge angegeben werden.')).not.toBeInTheDocument();
  });

});
