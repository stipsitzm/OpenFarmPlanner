import type { EditableRow, DataGridAPI } from '../../components/data-grid/DataGrid';
import type { Location, Field, Bed } from '../../api/api';

export interface TestGridRow extends EditableRow {
  id: number;
  name: string;
  area_sqm: number;
  notes?: string;
}

export const createGridRow = (overrides: Partial<TestGridRow> = {}): TestGridRow => ({
  id: 1,
  name: 'Beet A',
  area_sqm: 12,
  notes: '',
  ...overrides,
});

export const createGridApiMock = (): DataGridAPI<TestGridRow> => ({
  list: async () => ({ data: { results: [createGridRow()] } }),
  create: async (data) => ({ data: createGridRow({ ...(data as Partial<TestGridRow>), id: 100 }) }),
  update: async (id, data) => ({ data: createGridRow({ ...(data as Partial<TestGridRow>), id }) }),
  delete: async () => undefined,
});

export const createLocation = (overrides: Partial<Location> = {}): Location => ({
  id: 1,
  name: 'Standort Nord',
  ...overrides,
});

export const createField = (overrides: Partial<Field> = {}): Field => ({
  id: 10,
  name: 'Feld 10',
  location: 1,
  area_sqm: 120,
  notes: '',
  ...overrides,
});

export const createBed = (overrides: Partial<Bed> = {}): Bed => ({
  id: 100,
  name: 'Beet 100',
  field: 10,
  area_sqm: 20,
  notes: '',
  ...overrides,
});
