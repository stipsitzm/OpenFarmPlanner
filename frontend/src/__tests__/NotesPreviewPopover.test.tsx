import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const listMock = vi.fn();

vi.mock('../api/api', () => ({
  noteAttachmentAPI: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

import { NotesPreviewPopover } from '../components/data-grid/NotesPreviewPopover';

function renderPopover(overrides: Partial<React.ComponentProps<typeof NotesPreviewPopover>> = {}) {
  const anchorEl = document.createElement('div');
  document.body.appendChild(anchorEl);

  const props: React.ComponentProps<typeof NotesPreviewPopover> = {
    open: true,
    anchorEl,
    rawValue: 'Hallo **Welt**',
    hasValue: true,
    attachmentCount: 0,
    onClose: vi.fn(),
    onOpenNote: vi.fn(),
    onOpenAttachment: vi.fn(),
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    ...overrides,
  };

  return { ...render(<NotesPreviewPopover {...props} />), props };
}

describe('NotesPreviewPopover', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue({ data: [] });
  });

  it('shows the heading and a stripped-markdown preview of the note text', () => {
    renderPopover({ rawValue: 'Hallo **Welt**' });

    expect(screen.getByText('Notiz')).toBeInTheDocument();
    expect(screen.getByText('Hallo Welt')).toBeInTheDocument();
  });

  it('shows a fallback message when the row has no note text', () => {
    renderPopover({ hasValue: false, rawValue: '' });

    expect(screen.getByText('Keine Notiz vorhanden')).toBeInTheDocument();
  });

  it('calls onOpenNote when the "Notiz öffnen" action is clicked', () => {
    const { props } = renderPopover();

    fireEvent.click(screen.getByText('Notiz öffnen'));

    expect(props.onOpenNote).toHaveBeenCalledTimes(1);
  });

  it('lazily fetches attachments only when open with attachments present, and renders thumbnails', async () => {
    listMock.mockResolvedValue({
      data: [
        { id: 1, planting_plan: 1, image: 'a.webp', image_url: 'https://example.com/a.webp' },
        { id: 2, planting_plan: 1, image: 'b.webp', image_url: 'https://example.com/b.webp' },
      ],
    });

    renderPopover({ attachmentCount: 2, noteId: 5 });

    expect(listMock).toHaveBeenCalledWith(5);
    await waitFor(() => {
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });
  });

  it('does not fetch attachments when the popover is closed', () => {
    renderPopover({ open: false, attachmentCount: 2, noteId: 5 });
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows a "+N" overlay tile when there are more than 3 attachments', async () => {
    listMock.mockResolvedValue({
      data: [
        { id: 1, planting_plan: 1, image: 'a.webp', image_url: 'https://example.com/a.webp' },
        { id: 2, planting_plan: 1, image: 'b.webp', image_url: 'https://example.com/b.webp' },
        { id: 3, planting_plan: 1, image: 'c.webp', image_url: 'https://example.com/c.webp' },
        { id: 4, planting_plan: 1, image: 'd.webp', image_url: 'https://example.com/d.webp' },
        { id: 5, planting_plan: 1, image: 'e.webp', image_url: 'https://example.com/e.webp' },
      ],
    });

    renderPopover({ attachmentCount: 5, noteId: 6 });

    await waitFor(() => {
      expect(screen.getByText('+3')).toBeInTheDocument();
    });
    // 2 plain thumbnails (with real alt text) + 1 decorative overlay background
    // image (alt="", so it's presentational and excluded from the img role).
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(document.querySelectorAll('img')).toHaveLength(3);
  });

  it('clicking a thumbnail calls onOpenAttachment', async () => {
    listMock.mockResolvedValue({
      data: [{ id: 1, planting_plan: 1, image: 'a.webp', image_url: 'https://example.com/a.webp' }],
    });

    const { props } = renderPopover({ attachmentCount: 1, noteId: 8 });

    const thumbnail = await screen.findByRole('img');
    fireEvent.click(thumbnail.closest('button')!);

    expect(props.onOpenAttachment).toHaveBeenCalledTimes(1);
  });
});
