import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotesDrawer } from '../components/data-grid/NotesDrawer';

vi.mock('../api/api', () => ({
  noteAttachmentAPI: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    upload: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    delete: vi.fn().mockResolvedValue({}),
  },
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

    const image = screen.getByAltText('Crop source');
    Object.defineProperty(image, 'naturalWidth', { value: 2000, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 1200, configurable: true });
    fireEvent.load(image);

    expect(screen.getByTestId('crop-stage')).toBeInTheDocument();
    expect(screen.getByTestId('crop-handle-se')).toBeInTheDocument();
  });
});
