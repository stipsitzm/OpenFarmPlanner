import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { DateEditCell } from '../components/data-grid/DateEditCell';

const renderDateEditCell = (value: Date | string | null = new Date('2026-04-10T00:00:00')) => {
  const setEditCellValue = vi.fn().mockResolvedValue(true);

  render(
    <DateEditCell
      {...({
        id: 1,
        field: 'planting_date',
        value,
        hasFocus: true,
        api: { setEditCellValue },
      } as unknown as GridRenderEditCellParams)}
    />,
  );

  return { input: screen.getByDisplayValue(value ? '2026-04-10' : '') as HTMLInputElement, setEditCellValue };
};

describe('DateEditCell', () => {
  it('uses a native date input so the browser calendar button remains available', () => {
    const { input } = renderDateEditCell();

    expect(input).toHaveAttribute('type', 'date');
  });

  it.each([
    ['ArrowLeft', '2026-04-09'],
    ['ArrowRight', '2026-04-11'],
  ])('changes the date by one day with %s while editing', async (key, expectedDate) => {
    const { input, setEditCellValue } = renderDateEditCell();

    fireEvent.keyDown(input, { key });

    await waitFor(() => {
      expect(setEditCellValue).toHaveBeenCalledWith({
        id: 1,
        field: 'planting_date',
        value: new Date(`${expectedDate}T00:00:00`),
      });
    });
  });
});
