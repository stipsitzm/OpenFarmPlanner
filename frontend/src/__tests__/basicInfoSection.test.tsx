import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { supplierListMock } = vi.hoisted(() => ({
  supplierListMock: vi.fn(),
}));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('../api/api', () => ({
  supplierAPI: {
    list: supplierListMock,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');

  const MockAutocomplete = (props: Record<string, unknown>) => (
    <div>
      {props.renderInput ? props.renderInput({} as never) : null}
      <input
        aria-label="supplier-mock-input"
        onChange={(e) => props.onInputChange?.(e, (e.target as HTMLInputElement).value)}
      />
      <button type="button" onClick={() => props.onChange?.({} as never, null)}>clear-supplier</button>
      <button type="button" onClick={() => props.onChange?.({} as never, { id: -1, name: '+ Neuer Lieferant' })}>create-supplier</button>
      <button type="button" onClick={() => props.onChange?.({} as never, { id: 5, name: 'Bestehend' })}>select-supplier</button>
      <button
        type="button"
        onClick={() => {
          const labelA = props.getOptionLabel?.('Freitext');
          const labelB = props.getOptionLabel?.({ id: 5, name: 'Bestehend' });
          const equal = props.isOptionEqualToValue?.({ id: 5, name: 'A' }, { id: 5, name: 'B' });
          (window as Window & { __autocompleteProbe?: unknown }).__autocompleteProbe = {
            labelA,
            labelB,
            equal,
            loading: props.loading,
            noOptionsText: props.noOptionsText,
          };
        }}
      >
        probe-autocomplete
      </button>
    </div>
  );

  return {
    ...actual,
    Autocomplete: MockAutocomplete,
  };
});

import { BasicInfoSection } from '../cultures/sections/BasicInfoSection';

const mockI18n = {
  t: (key: string, options?: Record<string, unknown>) => {
    if (typeof options?.defaultValue === 'string') return options.defaultValue;
    return key;
  },
  $TFunctionBrand: undefined as unknown,
};

const t = mockI18n.t as unknown;

describe('BasicInfoSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supplierListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Biohof', allowed_domains: [] }] } });
  });

  it('updates basic text fields', () => {
    const onChange = vi.fn();

    render(
      <BasicInfoSection
        formData={{ name: 'Karotte', variety: 'Nantaise', crop_family: 'Apiaceae' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('form.namePlaceholder'), { target: { value: 'Möhre' } });
    fireEvent.change(screen.getByPlaceholderText('form.varietyPlaceholder'), { target: { value: 'Paris' } });
    fireEvent.change(screen.getByPlaceholderText('form.cropFamilyPlaceholder'), { target: { value: 'Asteraceae' } });

    expect(onChange).toHaveBeenCalledWith('name', 'Möhre');
    expect(onChange).toHaveBeenCalledWith('variety', 'Paris');
    expect(onChange).toHaveBeenCalledWith('crop_family', 'Asteraceae');
  });

  it('updates nutrient demand via select', () => {
    const onChange = vi.fn();

    render(
      <BasicInfoSection
        formData={{ nutrient_demand: '' }}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    const nutrientCombobox = screen.getAllByRole('combobox').at(-1);
    if (!nutrientCombobox) throw new Error('nutrient combobox not found');
    fireEvent.mouseDown(nutrientCombobox);
    fireEvent.click(screen.getByRole('option', { name: 'form.nutrientDemandHigh' }));

    expect(onChange).toHaveBeenCalledWith('nutrient_demand', 'high');
  });

  it('searches suppliers only when at least 2 characters are typed', async () => {
    const onChange = vi.fn();
    render(
      <BasicInfoSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    await waitFor(() => {
      expect(supplierListMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('supplier-mock-input'), { target: { value: 'b' } });
    expect(supplierListMock).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByLabelText('supplier-mock-input'), { target: { value: 'bi' } });
    await waitFor(() => {
      expect(supplierListMock).toHaveBeenCalledWith('bi');
    });
  });

  it('uses autocomplete label/equality helpers and loading flag', async () => {
    const onChange = vi.fn();

    render(
      <BasicInfoSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByLabelText('supplier-mock-input'), { target: { value: 'bi' } });
    await waitFor(() => {
      expect(supplierListMock).toHaveBeenCalledWith('bi');
    });

    fireEvent.click(screen.getByRole('button', { name: 'probe-autocomplete' }));

    expect((window as Window & { __autocompleteProbe?: unknown }).__autocompleteProbe).toEqual({
      labelA: undefined,
      labelB: 'Bestehend',
      equal: true,
      loading: false,
      noOptionsText: 'Keine Lieferanten vorhanden',
    });
  });

  it('handles supplier clear, select existing and redirect to create supplier', async () => {
    const onChange = vi.fn();

    render(
      <BasicInfoSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'clear-supplier' }));
    expect(onChange).toHaveBeenCalledWith('supplier', null);

    fireEvent.click(screen.getByRole('button', { name: 'select-supplier' }));
    expect(onChange).toHaveBeenCalledWith('supplier', { id: 5, name: 'Bestehend' });

    fireEvent.click(screen.getByRole('button', { name: 'create-supplier' }));
    expect(navigateMock).toHaveBeenCalledWith('/app/suppliers');
  });

  it('handles supplier list errors gracefully', async () => {
    const onChange = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    supplierListMock.mockRejectedValue(new Error('list failed'));

    render(
      <BasicInfoSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByLabelText('supplier-mock-input'), { target: { value: 'ab' } });

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  it('shows empty supplier state action', async () => {
    const onChange = vi.fn();
    supplierListMock.mockResolvedValue({ data: { results: [] } });

    render(
      <BasicInfoSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    expect(await screen.findByText('Keine Lieferanten vorhanden')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lieferanten anlegen' }));
    expect(navigateMock).toHaveBeenCalledWith('/app/suppliers');
  });
});
