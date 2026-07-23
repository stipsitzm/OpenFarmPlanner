import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCultureLibraryDialog } from '../crops/components/PublicCultureLibraryDialog';
import type { PublicCulture } from '../api/types';

const culture: PublicCulture = {
  id: 1,
  status: 'published',
  name: 'Tomate',
  variety: 'Roma',
  seed_supplier: 'Open Seeds',
  growth_duration_days: 70,
  harvest_duration_days: 28,
  version: 1,
};

function mockMobileViewport(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width:599.95px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockDesktopViewport(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width:900px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('PublicCultureLibraryDialog', () => {
  beforeEach(() => {
    mockMobileViewport();
    window.history.replaceState({ page: 'cultures' }, '', '/app/cultures');
  });

  it('closes the mobile dialog when the browser history entry is popped', async () => {
    const onClose = vi.fn();

    render(
      <PublicCultureLibraryDialog
        open
        loading={false}
        error={null}
        cultures={[culture]}
        importingId={null}
        onClose={onClose}
        onSearch={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(window.history.state).toMatchObject({
        openFarmPlannerPublicCultureLibrary: expect.any(String),
      });
    });

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/app/cultures');
    });
  });

  it('closes immediately when the mobile cancel button is clicked', async () => {
    function ClosableDialog() {
      const [open, setOpen] = useState(true);

      return (
        <PublicCultureLibraryDialog
          open={open}
          loading={false}
          error={null}
          cultures={[culture]}
          importingId={null}
          onClose={() => setOpen(false)}
          onSearch={vi.fn()}
          onImport={vi.fn()}
        />
      );
    }

    render(<ClosableDialog />);

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/app/cultures');
    });
  });

  it('uses a full viewport mobile paper with an opaque background', async () => {
    render(
      <PublicCultureLibraryDialog
        open
        loading={false}
        error={null}
        cultures={[culture]}
        importingId={null}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole('dialog');
    const paper = dialog.closest('.MuiDialog-paper');

    expect(paper).toHaveStyle({
      width: '100vw',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      margin: '0px',
    });
  });

  it('shows a community invitation in the desktop detail empty state', async () => {
    mockDesktopViewport();

    render(
      <PublicCultureLibraryDialog
        open
        loading={false}
        error={null}
        cultures={[culture]}
        importingId={null}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    await screen.findByRole('dialog');

    expect(screen.getByText('Die Kulturbibliothek wächst mit der Community')).toBeInTheDocument();
    expect(screen.getByText(/Veröffentliche deine bewährten Kulturen und teile dein Wissen/)).toBeInTheDocument();
    expect(screen.getByText(/Eigene Kulturen können später direkt aus den Kulturdetails veröffentlicht werden/)).toBeInTheDocument();
  });

  it('shows the community contribution empty state on mobile when the library is empty', async () => {
    render(
      <PublicCultureLibraryDialog
        open
        loading={false}
        error={null}
        cultures={[]}
        importingId={null}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    await screen.findByRole('dialog');

    expect(screen.getByText('Noch keine öffentlichen Kulturen vorhanden')).toBeInTheDocument();
    expect(screen.getByText(/Die Kulturbibliothek lebt von den Beiträgen der Community/)).toBeInTheDocument();
  });
});
