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

  it('builds hierarchy inline action callbacks for field, bed and location rows', async () => {
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
      mockT as never,
    );

    const notesColumn = columns.find((column) => column.field === 'notes');
    const nameColumn = columns.find((column) => column.field === 'name');

    notesColumn?.renderCell?.({
      id: 'field-10',
      value: 'Notiz **fett**',
      row: { id: 'field-10', type: 'field', level: 1 },
    } as never)?.props.onOpen();
    expect(openNotes).toHaveBeenCalledWith('field-10', 'notes');

    const { rerender } = render(
      <>
        {nameColumn?.renderCell?.({
          id: 'location-2',
          field: 'name',
          value: 'Standort 2',
          row: { id: 'location-2', type: 'location', locationId: 2, level: 0, expanded: true },
        } as never)}
      </>
    );
    await user.click(screen.getByLabelText('Feld hinzufügen'));
    expect(addField).toHaveBeenCalledWith(2);

    rerender(
      <>
        {nameColumn?.renderCell?.({
          id: 'field-10',
          field: 'name',
          value: 'Schlag 10',
          row: { id: 'field-10', type: 'field', fieldId: 10, level: 1, expanded: true },
        } as never)}
      </>
    );
    await user.click(screen.getByLabelText('Beet hinzufügen'));
    await user.click(screen.getByLabelText('Löschen'));
    expect(addBed).toHaveBeenCalledWith(10);
    expect(deleteField).toHaveBeenCalledWith(10);

    rerender(
      <>
        {nameColumn?.renderCell?.({
          id: 100,
          field: 'name',
          value: 'Beet 100',
          row: { id: 100, type: 'bed', bedId: 100, level: 2 },
        } as never)}
      </>
    );
    await user.click(screen.getByLabelText('Pflanzplan erstellen'));
    await user.click(screen.getByLabelText('Löschen'));
    expect(createPlan).toHaveBeenCalledWith(100);
    expect(deleteBed).toHaveBeenCalledWith(100);
  });


  it('hides inline action icons while the name cell is in edit mode', () => {
    const columns = createHierarchyColumns(
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      mockT as never,
    );

    const nameColumn = columns.find((column) => column.field === 'name');

    render(
      <>
        {nameColumn?.renderCell?.({
          id: 100,
          field: 'name',
          value: 'Beet 100',
          cellMode: 'edit',
          row: { id: 100, type: 'bed', bedId: 100, level: 2 },
        } as never)}
      </>
    );

    expect(screen.queryByLabelText('Pflanzplan erstellen')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Löschen')).not.toBeInTheDocument();
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
