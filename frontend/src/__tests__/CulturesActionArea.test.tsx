import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AxiosError } from 'axios';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';

const {
  listMock,
  locationListMock,
  fieldListMock,
  bedListMock,
  publicCultureListMock,
  publishPublicMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  locationListMock: vi.fn(),
  fieldListMock: vi.fn(),
  bedListMock: vi.fn(),
  publicCultureListMock: vi.fn(),
  publishPublicMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
      publishPublic: publishPublicMock,
    },
    locationAPI: {
      ...actual.locationAPI,
      list: locationListMock,
    },
    fieldAPI: {
      ...actual.fieldAPI,
      list: fieldListMock,
    },
    bedAPI: {
      ...actual.bedAPI,
      list: bedListMock,
    },
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      list: publicCultureListMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({
    cultures,
    onCultureSelect,
    onCreateCulture,
    onCreatePlan,
    onPublishCulture,
    onEditCulture,
    canCreatePlan,
    publishActionLabel,
  }: {
    cultures: Array<{ id?: number; name: string }>;
    onCultureSelect: (culture: { id?: number; name: string } | null) => void;
    onCreateCulture?: () => void;
    onCreatePlan?: () => void;
    onPublishCulture?: () => void;
    onEditCulture?: (culture: { id?: number; name: string }) => void;
    canCreatePlan?: boolean;
    publishActionLabel?: string;
  }): ReactElement => (
    <div data-testid="culture-detail-mock">
      <button type="button" onClick={() => onCreateCulture?.()}>Kultur hinzufügen</button>
      <button type="button" onClick={() => onPublishCulture?.()}>{publishActionLabel ?? 'Veröffentlichen'}</button>
      <button type="button" onClick={() => onCreatePlan?.()} disabled={!canCreatePlan}>Anbauplan erstellen</button>
      <button type="button" onClick={() => onEditCulture?.(cultures[0])}>Kultur bearbeiten</button>
      <button type="button" onClick={() => onCultureSelect(cultures[0] ?? null)}>select-culture</button>
    </div>
  ),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'tester@example.com', display_name: 'Tester' },
  }),
}));

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => ({
    shouldShowProjectRequiredState: false,
    missingProjectReason: null,
  }),
}));

function renderCultures(initialPath = '/cultures'): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/cultures"
          element={(
            <CommandProvider><Cultures /></CommandProvider>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('Cultures action area', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1 },
        ],
      },
    });

    publicCultureListMock.mockResolvedValue({
      data: {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    });
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Parzelle A', location: 1 }] } });
    bedListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Beet A', field: 1 }] } });
    publishPublicMock.mockResolvedValue({
      data: {
        operation: 'created',
        public_culture: { id: 99, name: 'Tomate', version: 1, status: 'published' },
        duplicates: [],
      },
    });
  });

  it('does not render a public library shortcut in the cultures action area', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kultur hinzufügen' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Öffentliche Kulturbibliothek' })).not.toBeInTheDocument();
  });

  it('keeps public culture API idle when no public-library button is rendered', async () => {
    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kultur hinzufügen' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Öffentliche Kulturbibliothek' })).not.toBeInTheDocument();
    expect(publicCultureListMock).not.toHaveBeenCalled();
  });

  it('shows duplicate publish warning when backend returns conflict', async () => {
    const duplicateError = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'duplicate_public_culture',
          detail: 'A similar public culture already exists.',
          duplicates: [{ id: 4, name: 'Tomate', variety: 'Roma', version: 1 }],
        },
      },
    } as AxiosError;
    publishPublicMock.mockRejectedValue(duplicateError);

    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Veröffentlichen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }));

    await waitFor(() => {
      expect(publishPublicMock).toHaveBeenCalledWith(1);
      expect(screen.getByText('Diese Kultur ist bereits öffentlich vorhanden: Tomate (Roma)')).toBeInTheDocument();
    });
  });

  it('does not attempt to render public-library entries without a trigger', async () => {
    publicCultureListMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 11, name: 'Salat', variety: 'Bijella', supplier_name: 'Reinsaat', status: 'published', version: 1, published_at: '2026-03-10T12:00:00Z' },
          { id: 12, name: ' salat ', variety: ' BIJELLA ', seed_supplier: '  rein saat  ', status: 'published', version: 1, published_at: '2026-03-11T12:00:00Z' },
        ],
      },
    });

    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kultur hinzufügen' })).toBeInTheDocument();
    });

    expect(screen.queryByText('Salat (Bijella)')).not.toBeInTheDocument();
    expect(publicCultureListMock).not.toHaveBeenCalled();
  });

  it('shows update label for cultures linked to an owned public culture', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1, owned_public_culture_id: 77 },
        ],
      },
    });

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Öffentliche Kulturbibliothek aktualisieren' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Veröffentlichen' })).not.toBeInTheDocument();
  });

  it('disables create planting plan button with bed-specific guidance when no beds exist', async () => {
    bedListMock.mockResolvedValue({ data: { results: [] } });
    renderCultures('/cultures?cultureId=1');

    const createPlanButton = await screen.findByRole('button', { name: 'Anbauplan erstellen' });
    expect(createPlanButton).toBeDisabled();
    const fieldsBedsLink = await screen.findByRole('link', { name: 'Zu Anbauflächen' });
    expect(fieldsBedsLink).toBeInTheDocument();
    expect(fieldsBedsLink).toHaveAttribute('href', '/app/fields-beds');
    expect(screen.queryByRole('link', { name: 'Beet anlegen' })).not.toBeInTheDocument();

    fireEvent.mouseOver(createPlanButton.parentElement as HTMLElement);
    expect(await screen.findByText('Du brauchst zuerst mindestens ein Beet. Beete werden innerhalb einer Parzelle auf der Seite Anbauflächen hinzugefügt.')).toBeInTheDocument();
  });

  it('enables create planting plan button when all prerequisites are present', async () => {
    renderCultures('/cultures?cultureId=1');
    const createPlanButton = await screen.findByRole('button', { name: 'Anbauplan erstellen' });
    await waitFor(() => expect(createPlanButton).toBeEnabled());
  });
});
