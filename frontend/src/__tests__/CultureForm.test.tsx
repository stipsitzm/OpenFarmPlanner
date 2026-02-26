import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CultureForm } from '../cultures/CultureForm';
import type { Culture } from '../api/types';

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../cultures/sections/BasicInfoSection', () => ({
  BasicInfoSection: ({ formData, onChange }: { formData: Partial<Culture>; onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void }) => (
    <div>
      <input
        aria-label="name-input"
        value={formData.name ?? ''}
        onChange={(event) => onChange('name', event.target.value)}
      />
      <input
        aria-label="variety-input"
        value={formData.variety ?? ''}
        onChange={(event) => onChange('variety', event.target.value)}
      />
    </div>
  ),
}));

vi.mock('../cultures/sections/SpacingSection', () => ({
  SpacingSection: ({ formData, onChange }: { formData: Partial<Culture>; onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void }) => (
    <input
      aria-label="row-spacing-input"
      value={formData.row_spacing_cm ?? ''}
      onChange={(event) => onChange('row_spacing_cm', Number(event.target.value))}
    />
  ),
}));

vi.mock('../cultures/sections/TimingSection', () => ({ TimingSection: () => null }));
vi.mock('../cultures/sections/HarvestSection', () => ({ HarvestSection: () => null }));
vi.mock('../cultures/sections/SeedingSection', () => ({ SeedingSection: () => null }));
vi.mock('../cultures/sections/ColorSection', () => ({ ColorSection: () => null }));
vi.mock('../cultures/sections/NotesSection', () => ({ NotesSection: () => null }));

const CULTURE_A: Culture = {
  id: 1,
  name: 'Karotte',
  variety: 'Nantaise',
  supplier: { id: 10, name: 'Bingenheimer' },
};

const CULTURE_B: Culture = {
  id: 2,
  name: 'Salat',
  variety: 'Batavia',
  supplier: { id: 11, name: 'Dreschflegel' },
};

describe('CultureForm', () => {
  it('saves changed form data when editing a culture', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      name: 'Neue Karotte',
      variety: 'Nantaise',
      supplier: { id: 10, name: 'Bingenheimer' },
    }));
  });

  it('saves spacing values for culture edit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_B} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('row-spacing-input'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 2,
      name: 'Salat',
      variety: 'Batavia',
      row_spacing_cm: 35,
      supplier: { id: 11, name: 'Dreschflegel' },
    }));
  });

  it('maps legacy seed_supplier into supplier field for validation and save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={{ id: 3, name: 'Mangold', variety: 'Rainbow', seed_supplier: 'Legacy Seeds' }} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('row-spacing-input'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 3,
      supplier: { name: 'Legacy Seeds' },
      row_spacing_cm: 40,
    }));
  });

  it('resets form state when a different culture is opened for editing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Zwischenstand' } });

    rerender(<CultureForm culture={CULTURE_B} onSave={onSave} onCancel={() => {}} />);

    expect(screen.getByLabelText('name-input')).toHaveValue('Salat');
    expect(screen.getByLabelText('variety-input')).toHaveValue('Batavia');

    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 2,
      name: 'Salat',
      variety: 'Batavia',
      supplier: { id: 11, name: 'Dreschflegel' },
    }));
  });
});
