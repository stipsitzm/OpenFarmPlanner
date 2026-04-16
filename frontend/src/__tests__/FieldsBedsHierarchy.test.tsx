import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FieldsBedsHierarchy from '../pages/FieldsBedsHierarchy';
import { mockT } from './helpers/testI18n';
import { createBed, createField, createLocation } from './helpers/factories';

const {
  addFieldMock,
  addBedMock,
  navigateMock,
  useHierarchyDataMock,
} = vi.hoisted(() => ({
  addFieldMock: vi.fn(),
  addBedMock: vi.fn(),
  navigateMock: vi.fn(),
  useHierarchyDataMock: vi.fn(),
}));

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../components/hierarchy/hooks/useHierarchyData', () => ({
  useHierarchyData: () => useHierarchyDataMock(),
}));

vi.mock('../components/hierarchy/hooks/useFieldOperations', () => ({
  useFieldOperations: () => ({
    addField: addFieldMock,
    deleteField: vi.fn(),
  }),
}));

vi.mock('../components/hierarchy/hooks/useBedOperations', () => ({
  useBedOperations: () => ({
    addBed: addBedMock,
    saveBed: vi.fn(),
    deleteBed: vi.fn(),
    pendingEditRow: null,
    setPendingEditRow: vi.fn(),
  }),
}));

vi.mock('../components/hierarchy/hooks/useExpandedState', () => ({
  useExpandedState: () => ({
    expandedRows: new Set(['location-1', 'location-2', 'field-10']),
    hasPersistedState: true,
    toggleExpand: vi.fn(),
    ensureExpanded: vi.fn(),
    expandAll: vi.fn(),
  }),
}));

vi.mock('../hooks/usePersistentSortModel', () => ({
  usePersistentSortModel: () => ({
    sortModel: [],
    setSortModel: vi.fn(),
  }),
}));

vi.mock('../components/data-grid', () => ({
  useNotesEditor: () => ({
    isOpen: false,
    draft: '',
    setDraft: vi.fn(),
    handleSave: vi.fn(),
    handleClose: vi.fn(),
    handleOpen: vi.fn(),
    isSaving: false,
  }),
  NotesDrawer: () => null,
}));

vi.mock('../commands/useCommandContext', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
}));

vi.mock('@mui/x-data-grid', () => ({
  GridRowModes: { Edit: 'edit' },
  DataGrid: ({ rows, columns }: { rows: Array<Record<string, unknown>>; columns: Array<Record<string, unknown>> }) => {
    const nameColumn = columns.find((column) => column.field === 'name');

    return (
      <div data-testid="mock-grid">
        {rows.map((row) => (
          <div key={String(row.id)}>
            {typeof nameColumn?.renderCell === 'function'
              ? nameColumn.renderCell({
                  id: row.id,
                  field: 'name',
                  value: row.name,
                  row,
                  cellMode: 'view',
                })
              : null}
          </div>
        ))}
      </div>
    );
  },
}));

const createHierarchyHookState = (locationsCount: 0 | 1 | 2) => {
  const locations =
    locationsCount === 0
      ? []
      : locationsCount === 1
        ? [createLocation({ id: 1, name: 'Hofstelle' })]
        : [
            createLocation({ id: 1, name: 'Hofstelle' }),
            createLocation({ id: 2, name: 'Pachtfläche' }),
          ];

  const fields = locationsCount === 2 ? [createField({ id: 10, location: 1, name: 'Schlag A' })] : [];
  const beds = locationsCount === 2 ? [createBed({ id: 100, field: 10, name: 'Beet 1' })] : [];

  return {
    loading: false,
    error: '',
    setError: vi.fn(),
    locations,
    fields,
    beds,
    setBeds: vi.fn(),
    setFields: vi.fn(),
    fetchData: vi.fn(),
  };
};

describe('FieldsBedsHierarchy global actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHierarchyDataMock.mockReturnValue(createHierarchyHookState(0));
  });

  it('shows "Standort anlegen" when no location exists', async () => {
    const user = userEvent.setup();

    render(<FieldsBedsHierarchy />);

    const button = screen.getByRole('button', { name: 'Standort anlegen' });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(navigateMock).toHaveBeenCalledWith('/app/locations');
    expect(addFieldMock).not.toHaveBeenCalled();
  });

  it('shows "Schlag hinzufügen" for one location and uses it automatically', async () => {
    const user = userEvent.setup();
    useHierarchyDataMock.mockReturnValue(createHierarchyHookState(1));

    render(<FieldsBedsHierarchy />);

    expect(screen.getByRole('button', { name: 'Schlag hinzufügen' })).toBeInTheDocument();
    expect(screen.getByText('Standort: Hofstelle')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Schlag hinzufügen' }));

    expect(addFieldMock).toHaveBeenCalledWith(1);
  });

  it('shows "Schlag hinzufügen" for multiple locations and asks for location selection', async () => {
    const user = userEvent.setup();
    useHierarchyDataMock.mockReturnValue(createHierarchyHookState(2));
    window.prompt = vi.fn().mockReturnValue('2');

    render(<FieldsBedsHierarchy />);

    await user.click(screen.getByRole('button', { name: 'Schlag hinzufügen' }));

    expect(window.prompt).toHaveBeenCalledOnce();
    expect(addFieldMock).toHaveBeenCalledWith(2);
  });

  it('keeps existing row plus actions for location -> field and field -> bed', async () => {
    const user = userEvent.setup();
    useHierarchyDataMock.mockReturnValue(createHierarchyHookState(2));

    render(<FieldsBedsHierarchy />);

    const addFieldButtons = screen.getAllByLabelText('Parzelle hinzufügen');
    const addBedButton = screen.getByLabelText('Beet hinzufügen');

    await user.click(addFieldButtons[0]);
    await user.click(addBedButton);

    expect(addFieldMock).toHaveBeenCalledWith(1);
    expect(addBedMock).toHaveBeenCalledWith(10);
  });
});
