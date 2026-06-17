import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotesDrawer } from '../components/data-grid/NotesDrawer';

vi.mock('../api/api', () => ({
  noteAttachmentAPI: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    upload: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../components/data-grid/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe('NotesDrawer attachments', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows camera + gallery buttons', async () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    expect(await screen.findByText('Foto aufnehmen')).toBeInTheDocument();
    expect(screen.getByText('Aus Galerie wählen')).toBeInTheDocument();
  });

  it('uses capture environment for camera input', () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    expect(fileInputs).toHaveLength(2);
    expect(fileInputs.every((input) => input.accept === 'image/*')).toBe(true);

    const cameraInput = document.querySelector('input[capture]') as HTMLInputElement | null;
    expect(cameraInput).not.toBeNull();
    expect(cameraInput?.getAttribute('capture')).toBe('environment');
    expect(cameraInput?.accept).toBe('image/*');
  });

  it('opens interactive crop dialog after file select', () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    const galleryInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    const file = new File(['x'], 'crop.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [file] } });

    const image = screen.getByAltText('Zuschneidequelle');
    Object.defineProperty(image, 'naturalWidth', { value: 2000, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 1200, configurable: true });
    fireEvent.load(image);

    expect(screen.getByTestId('crop-stage')).toBeInTheDocument();
    expect(screen.getByTestId('crop-handle-se')).toBeInTheDocument();
  });

  it('closes the drawer with Escape when notes are unchanged', async () => {
    const onClose = vi.fn();
    render(<NotesDrawer open title="Notes" value="Existing note" onChange={() => {}} onSave={() => {}} onClose={onClose} noteId={1} />);

    const textbox = await screen.findByRole('textbox');
    fireEvent.keyDown(textbox, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before closing with Escape when notes have unsaved changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <NotesDrawer
        open
        title="Notes"
        value="Changed note"
        onChange={() => {}}
        onSave={() => {}}
        onClose={onClose}
        hasUnsavedChanges
        noteId={1}
      />,
    );

    const textbox = await screen.findByRole('textbox');
    fireEvent.keyDown(textbox, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ungespeicherte Notizen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ungespeicherte Notizen' })).not.toBeInTheDocument();
    });

    fireEvent.keyDown(textbox, { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'Änderungen verwerfen und schließen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the unsaved confirmation when Cancel is clicked with dirty notes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <NotesDrawer
        open
        title="Notes"
        value="Changed note"
        onChange={() => {}}
        onSave={() => {}}
        onClose={onClose}
        hasUnsavedChanges
        noteId={1}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ungespeicherte Notizen' })).toBeInTheDocument();
  });
});
