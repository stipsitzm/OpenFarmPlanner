import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHierarchyColumns } from '../components/hierarchy/HierarchyColumns';
import { HierarchyFooter } from '../components/hierarchy/HierarchyFooter';
import { buildHierarchyRows } from '../components/hierarchy/utils/hierarchyUtils';
import { createBed, createField, createLocation } from './helpers/factories';
import { mockT } from './helpers/testI18n';

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: mockT }),
}));

describe('hierarchy components and behaviors', () => {
  it('renders nested rows, handles duplicate labels and deep nesting expansion states', () => {
    const locations = [createLocation({ id: 1, name: 'Standort' })];
    const fields = [
      createField({ id: 11, location: 1, name: 'Duplikat' }),
      createField({ id: 12, location: 1, name: 'Duplikat' }),
    ];
    const beds = [
      createBed({ id: 101, field: 11, name: 'Ebene Tief 1' }),
      createBed({ id: 102, field: 12, name: 'Ebene Tief 2' }),
    ];

    const rows = buildHierarchyRows(locations, fields, beds, new Set(['field-11', 'field-12']));

    expect(rows.filter((row) => row.type === 'field')).toHaveLength(2);
    expect(rows.filter((row) => row.name === 'Duplikat')).toHaveLength(2);
    expect(rows.filter((row) => row.type === 'bed')).toHaveLength(2);
  });

  it('handles empty and single-node tree edge cases', () => {
    expect(buildHierarchyRows([], [], [], new Set())).toEqual([]);

    const rows = buildHierarchyRows([createLocation({ id: 5 })], [], [], new Set());
    expect(rows).toHaveLength(0);
  });

  it('supports expand/collapse and node action callbacks', async () => {
    const user = userEvent.setup();
    const toggleExpand = vi.fn();
    const addBed = vi.fn();
    const deleteBed = vi.fn();
    const addField = vi.fn();
    const deleteField = vi.fn();
    const createPlan = vi.fn();
    const openNotes = vi.fn();

    const columns = createHierarchyColumns(
      toggleExpand,
      addBed,
      deleteBed,
      addField,
      deleteField,
      createPlan,
      openNotes,
      mockT as any,
    );

    const nameColumn = columns.find((column) => column.field === 'name');
    const notesColumn = columns.find((column) => column.field === 'notes');
    const actionsColumn = columns.find((column) => column.field === 'actions');

    const locationCell = nameColumn?.renderCell?.({
      id: 'location-1',
      value: 'Standort Nord',
      row: { id: 'location-1', type: 'location', name: 'Standort Nord', level: 0, expanded: false },
    } as any);

    render(<>{locationCell}</>);
    await user.click(screen.getByRole('button'));
    expect(toggleExpand).toHaveBeenCalledWith('location-1');

    const notesCell = notesColumn?.renderCell?.({
      id: 'field-10',
      value: 'Notiz **fett**',
      row: { id: 'field-10', type: 'field', level: 1 },
    } as any);

    render(<>{notesCell}</>);
    await user.click(screen.getByRole('button', { name: 'Notizen bearbeiten' }));
    expect(openNotes).toHaveBeenCalledWith('field-10', 'notes');

    const fieldActions = actionsColumn?.getActions?.({
      id: 'field-10',
      row: { id: 'field-10', type: 'field', fieldId: 10 },
    } as any);
    render(<>{fieldActions}</>);
    await user.click(screen.getByRole('button', { name: /Beet hinzufügen/i }));
    await user.click(screen.getByRole('button', { name: /Löschen/i }));
    expect(addBed).toHaveBeenCalledWith(10);
    expect(deleteField).toHaveBeenCalledWith(10);

    const bedActions = actionsColumn?.getActions?.({
      id: 100,
      row: { id: 100, type: 'bed', bedId: 100 },
    } as any);
    render(<>{bedActions}</>);
    await user.click(screen.getByRole('button', { name: /Pflanzplan erstellen/i }));
    await user.click(screen.getAllByRole('button', { name: /Löschen/i })[1]);
    expect(createPlan).toHaveBeenCalledWith(100);
    expect(deleteBed).toHaveBeenCalledWith(100);

    const locationActions = actionsColumn?.getActions?.({
      id: 'location-2',
      row: { id: 'location-2', type: 'location', locationId: 2 },
    } as any);
    render(<>{locationActions}</>);
    await user.click(screen.getByRole('button', { name: /Feld hinzufügen/i }));
    expect(addField).toHaveBeenCalledWith(2);
  });

  it('updates footer messaging and add action based on location count', async () => {
    const user = userEvent.setup();
    const onAddField = vi.fn();

    const { rerender } = render(
      <HierarchyFooter locations={[createLocation({ id: 9 })]} onAddField={onAddField} />,
    );

    await user.click(screen.getByLabelText('Feld hinzufügen'));
    expect(onAddField).toHaveBeenCalledWith(9);
    expect(screen.getByText('Ein Standort')).toBeInTheDocument();

    rerender(
      <HierarchyFooter
        locations={[createLocation({ id: 9 }), createLocation({ id: 10 })]}
        onAddField={onAddField}
      />,
    );

    expect(screen.queryByLabelText('Feld hinzufügen')).not.toBeInTheDocument();
    expect(screen.getByText('Mehrere Standorte')).toBeInTheDocument();
  });
});
