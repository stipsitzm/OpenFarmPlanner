import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { supplierListMock, supplierCreateMock } = vi.hoisted(() => ({
  supplierListMock: vi.fn(),
  supplierCreateMock: vi.fn(),
}));

vi.mock('../api/api', () => ({
  supplierAPI: {
    list: supplierListMock,
    create: supplierCreateMock,
  },
}));

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');

  const MockAutocomplete = (props: Record<string, any>) => (
    <div>
      {props.renderInput ? props.renderInput({} as never) : null}
      <input
        aria-label="supplier-mock-input"
        onChange={(e) => props.onInputChange?.(e, (e.target as HTMLInputElement).value)}
      />
      <button type="button" onClick={() => props.onChange?.({} as never, null)}>clear-supplier</button>
      <button type="button" onClick={() => props.onChange?.({} as never, 'Neuer Lieferant')}>create-supplier</button>
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

const t = (key: string, options?: Record<string, unknown>) => {
  if (typeof options?.defaultValue === 'string') return options.defaultValue;
  return key;
};

describe('BasicInfoSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    supplierListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Biohof' }] } });

    render(
      <BasicInfoSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByLabelText('supplier-mock-input'), { target: { value: 'b' } });
    expect(supplierListMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('supplier-mock-input'), { target: { value: 'bi' } });
    await waitFor(() => {
      expect(supplierListMock).toHaveBeenCalledWith('bi');
    });
  });

  it('uses autocomplete label/equality helpers and loading flag', async () => {
    const onChange = vi.fn();
    supplierListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Biohof' }] } });

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
      labelA: 'Freitext',
      labelB: 'Bestehend',
      equal: true,
      loading: false,
    });
  });

  it('handles supplier clear, select existing and create new supplier', async () => {
    const onChange = vi.fn();
    supplierCreateMock.mockResolvedValue({ data: { id: 9, name: 'Neuer Lieferant' } });

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
    await waitFor(() => {
      expect(supplierCreateMock).toHaveBeenCalledWith('Neuer Lieferant');
      expect(onChange).toHaveBeenCalledWith('supplier', { id: 9, name: 'Neuer Lieferant' });
    });
  });

  it('handles supplier list/create errors gracefully', async () => {
    const onChange = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    supplierListMock.mockRejectedValue(new Error('list failed'));
    supplierCreateMock.mockRejectedValue(new Error('create failed'));

    render(
      <BasicInfoSection
        formData={{}}
        errors={{}}
        onChange={onChange}
        t={t}
      />
    );

    fireEvent.change(screen.getByLabelText('supplier-mock-input'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'create-supplier' }));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
