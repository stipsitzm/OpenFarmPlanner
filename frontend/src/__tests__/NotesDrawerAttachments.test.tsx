import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  it('shows add photo button', async () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    expect(await screen.findByText('Foto hinzufügen')).toBeInTheDocument();
  });

  it('shows save button', () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
  });
});
