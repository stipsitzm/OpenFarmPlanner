import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CultureForm } from '../cultures/CultureForm';
import type { Culture } from '../api/types';

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { cultureDuplicateCheckMock, navigateMock, publicCultureMatchMock, supplierListMock } = vi.hoisted(() => ({
  cultureDuplicateCheckMock: vi.fn().mockResolvedValue({ data: { exists: false } }),
  navigateMock: vi.fn(),
  publicCultureMatchMock: vi.fn().mockResolvedValue({ data: { exists: false, culture: null } }),
  supplierListMock: vi.fn().mockResolvedValue({ data: { results: [] } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      duplicateCheck: cultureDuplicateCheckMock,
    },
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      match: publicCultureMatchMock,
    },
    supplierAPI: {
      list: supplierListMock,
    },
  };
});

vi.mock('../cultures/sections/BasicInfoSection', () => ({
  BasicInfoSection: ({ formData, errors, onChange }: { formData: Partial<Culture>; errors: Record<string, string>; onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void }) => (
    <div>
      <input
        aria-label="name-input"
        value={formData.name ?? ''}
        onChange={(event) => onChange('name', event.target.value)}
      />
      {errors.name ? <span>{errors.name}</span> : null}
      <input
        aria-label="variety-input"
        value={formData.variety ?? ''}
        onChange={(event) => onChange('variety', event.target.value)}
      />
      {errors.variety ? <span>{errors.variety}</span> : null}
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
vi.mock('../cultures/sections/SeedingSection', () => ({
  SeedingSection: ({ formData, onChange }: { formData: Partial<Culture>; onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void }) => (
    <input
      aria-label="thousand-kernel-input"
      value={formData.thousand_kernel_weight_g ?? ''}
      onChange={(event) => onChange('thousand_kernel_weight_g', event.target.value === '' ? undefined : Number(event.target.value))}
    />
  ),
}));
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
  beforeEach(() => {
    navigateMock.mockReset();
    cultureDuplicateCheckMock.mockReset();
    cultureDuplicateCheckMock.mockResolvedValue({ data: { exists: false } });
    publicCultureMatchMock.mockReset();
    publicCultureMatchMock.mockResolvedValue({ data: { exists: false, culture: null } });
    supplierListMock.mockReset();
    supplierListMock.mockResolvedValue({ data: { results: [] } });
  });

  it('renders supplier selection states based on supplier availability', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [] } });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(supplierListMock).toHaveBeenCalled());
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('form.noSuppliersHint')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    expect(navigateMock).toHaveBeenCalledWith('/app/suppliers?create=1');
  });

  it('does not show create-supplier helper link when supplier options are available', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [{ id: 99, name: 'New Supplier' }] } });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'form.createNewSupplierInline' })).not.toBeInTheDocument();
  });

  it('falls back to empty supplier selection when saved supplier is not in options', async () => {
    supplierListMock.mockResolvedValueOnce({ data: { results: [{ id: 99, name: 'Different Supplier' }] } });

    render(
      <CultureForm
        culture={{
          ...CULTURE_A,
          supplier_data: [{ supplier_id: 10, supplier_name: 'Bingenheimer', packaging_sizes: [] }],
        }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(screen.getByRole('combobox')).toHaveTextContent('form.supplierPlaceholder');
  });

  it('loads all existing supplier rows when editing a culture', async () => {
    supplierListMock.mockResolvedValueOnce({
      data: {
        results: [
          { id: 10, name: 'Bingenheimer' },
          { id: 11, name: 'Dreschflegel' },
        ],
      },
    });

    render(
      <CultureForm
        culture={{
          ...CULTURE_A,
          supplier_data: [
            { supplier_id: 10, supplier_name: 'Bingenheimer', packaging_sizes: [{ size_value: 25, size_unit: 'g' }] },
            { supplier_id: 11, supplier_name: 'Dreschflegel', packaging_sizes: [{ size_value: 50, size_unit: 'g' }] },
          ],
        }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Bingenheimer')).toBeInTheDocument();
      expect(screen.getByText('Dreschflegel')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
  });

  it('renders separated general and supplier-specific sections', () => {
    render(<CultureForm culture={CULTURE_A} onSave={vi.fn().mockResolvedValue(undefined)} onCancel={() => {}} />);

    expect(screen.getByText('form.generalInfoSectionTitle')).toBeInTheDocument();
    expect(screen.getByText('form.supplierDataSectionTitle')).toBeInTheDocument();
  });

  it('shows duplicate culture validation and blocks saving', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    cultureDuplicateCheckMock.mockResolvedValueOnce({ data: { exists: true } });

    try {
      render(<CultureForm onSave={onSave} onCancel={() => {}} />);

      fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Karotte' } });
      fireEvent.change(screen.getByLabelText('variety-input'), { target: { value: 'Nantaise' } });
      vi.advanceTimersByTime(400);

      await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
        { name: 'Karotte', variety: 'Nantaise', exclude_id: undefined },
        expect.any(AbortSignal),
      ));
      expect(await screen.findByText('form.duplicateNameVariety')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'form.create' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'form.create' }));
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves changed form data when editing a culture', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('name-input'), { target: { value: 'Neue Karotte' } });

    await waitFor(() => expect(cultureDuplicateCheckMock).toHaveBeenCalledWith(
      { name: 'Neue Karotte', variety: 'Nantaise', exclude_id: 1 },
      expect.any(AbortSignal),
    ));
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

  it('saves thousand-kernel weight directly on culture data', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('thousand-kernel-input'), { target: { value: '4.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      thousand_kernel_weight_g: 4.2,
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
      supplier: expect.objectContaining({ name: 'Legacy Seeds' }),
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

  it('renders save error inline instead of snackbar overlap', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'));

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'form.save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('messages.updateError')).toBeInTheDocument();
  });

  it('focuses the scrollable dialog content when opened', async () => {
    render(<CultureForm culture={CULTURE_A} onSave={vi.fn().mockResolvedValue(undefined)} onCancel={() => {}} />);

    const content = document.querySelector('.MuiDialogContent-root') as HTMLDivElement | null;
    expect(content).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(content));
  });

  it('keeps normal input keyboard handling without scrolling dialog content', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);
    const content = document.querySelector('.MuiDialogContent-root') as HTMLDivElement | null;
    expect(content).toBeTruthy();
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(content, 'scrollHeight', { value: 500, configurable: true });

    const nameInput = screen.getByLabelText('name-input');
    (nameInput as HTMLInputElement).focus();

    fireEvent.keyDown(nameInput, { key: 'ArrowDown' });
    fireEvent.keyDown(nameInput, { key: 'PageDown' });
    fireEvent.keyDown(nameInput, { key: ' ' });

    expect(content?.scrollTop).toBe(0);
  });

  it('scrolls dialog content with keyboard when the dialog content is focused', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const content = document.querySelector('.MuiDialogContent-root') as HTMLDivElement | null;
    expect(content).toBeTruthy();
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(content, 'scrollHeight', { value: 500, configurable: true });
    await waitFor(() => expect(document.activeElement).toBe(content));

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'PageDown' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'Home' });
    fireEvent.keyDown(window, { key: 'End' });

    expect(content?.scrollTop).toBe(400);
  });

  it('keeps scroll keys trapped when dialog content is already at a boundary', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const backgroundKeyHandler = vi.fn();

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const content = document.querySelector('.MuiDialogContent-root') as HTMLDivElement | null;
    expect(content).toBeTruthy();
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(content, 'scrollHeight', { value: 500, configurable: true });
    await waitFor(() => expect(document.activeElement).toBe(content));
    content!.scrollTop = 400;

    window.addEventListener('keydown', backgroundKeyHandler);
    const event = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
    const wasNotCanceled = window.dispatchEvent(event);
    window.removeEventListener('keydown', backgroundKeyHandler);

    expect(content?.scrollTop).toBe(400);
    expect(event.defaultPrevented).toBe(true);
    expect(wasNotCanceled).toBe(false);
    expect(backgroundKeyHandler).not.toHaveBeenCalled();
  });

  it('scrolls dialog content when focus is on dialog actions', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);
    const content = document.querySelector('.MuiDialogContent-root') as HTMLDivElement | null;
    expect(content).toBeTruthy();
    Object.defineProperty(content, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(content, 'scrollHeight', { value: 500, configurable: true });

    const saveButton = screen.getByRole('button', { name: 'form.save' });
    (saveButton as HTMLButtonElement).focus();

    fireEvent.keyDown(window, { key: 'PageDown' });

    expect(content?.scrollTop).toBe(200);
  });

});
