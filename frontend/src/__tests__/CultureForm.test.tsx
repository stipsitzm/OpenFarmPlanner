import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CultureForm } from '../cultures/CultureForm';
import type { Culture } from '../api/types';

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { supplierListMock, supplierCreateMock } = vi.hoisted(() => ({
  supplierListMock: vi.fn().mockResolvedValue({ data: { results: [] } }),
  supplierCreateMock: vi.fn().mockResolvedValue({
    data: { id: 101, name: 'Neu', homepage_url: 'https://example.com', allowed_domains: [] },
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    supplierAPI: {
      list: supplierListMock,
      create: supplierCreateMock,
    },
  };
});

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
  beforeEach(() => {
    supplierListMock.mockReset();
    supplierCreateMock.mockReset();
    supplierListMock.mockResolvedValue({ data: { results: [] } });
    supplierCreateMock.mockResolvedValue({
      data: { id: 101, name: 'Neu', homepage_url: 'https://example.com', allowed_domains: [] },
    });
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
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('form.supplierDataEmptyStateDescription')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    expect(screen.getByLabelText('form.supplierNameLabel')).toBeInTheDocument();
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

  it('creates a supplier inline and keeps the culture form open', async () => {
    supplierListMock
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [{ id: 101, name: 'Neu' }] } });

    render(
      <CultureForm
        culture={{ ...CULTURE_A, supplier_data: [{ packaging_sizes: [] }] }}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('form.supplierDataEmptyStateDescription')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'form.createSuppliers' }));
    fireEvent.change(screen.getByLabelText('form.supplierNameLabel'), { target: { value: 'Neu' } });
    fireEvent.change(screen.getByLabelText('form.supplierHomepage'), { target: { value: 'neu.example.com' } });
    const createButtons = screen.getAllByRole('button', { name: 'form.createSuppliers' });
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() => expect(supplierCreateMock).toHaveBeenCalledWith('Neu', 'https://neu.example.com', []));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(screen.getByRole('combobox')).toHaveTextContent('Neu');
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

  it('renders separated general and supplier-specific sections', () => {
    render(<CultureForm culture={CULTURE_A} onSave={vi.fn().mockResolvedValue(undefined)} onCancel={() => {}} />);

    expect(screen.getByText('form.generalInfoSectionTitle')).toBeInTheDocument();
    expect(screen.getByText('form.supplierDataSectionTitle')).toBeInTheDocument();
  });

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
    expect(screen.getByText('messages.updateError')).toBeInTheDocument();
  });

  it('scrolls dialog content with arrow and page keys, even when an input is focused', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const scrollByMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      value: scrollByMock,
      configurable: true,
      writable: true,
    });

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);
    const content = document.querySelector('.MuiDialogContent-root');
    expect(content).toBeTruthy();

    const nameInput = screen.getByLabelText('name-input');
    (nameInput as HTMLInputElement).focus();

    fireEvent.keyDown(nameInput, { key: 'ArrowDown' });
    fireEvent.keyDown(nameInput, { key: 'PageDown' });

    expect(scrollByMock).toHaveBeenCalled();
  });

  it('scrolls dialog content with keyboard when no field is focused', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const scrollByMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      value: scrollByMock,
      configurable: true,
      writable: true,
    });

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const nameInput = screen.getByLabelText('name-input');
    (nameInput as HTMLInputElement).focus();
    (nameInput as HTMLInputElement).blur();

    fireEvent.keyDown(window, { key: 'ArrowDown' });

    expect(scrollByMock).toHaveBeenCalled();
  });

  it('scrolls dialog content when focus is on dialog actions', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const scrollByMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      value: scrollByMock,
      configurable: true,
      writable: true,
    });

    render(<CultureForm culture={CULTURE_A} onSave={onSave} onCancel={() => {}} />);

    const saveButton = screen.getByRole('button', { name: 'form.save' });
    (saveButton as HTMLButtonElement).focus();

    fireEvent.keyDown(window, { key: 'PageDown' });

    expect(scrollByMock).toHaveBeenCalled();
  });
});
