import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotesCell } from '../components/data-grid/NotesCell';

describe('NotesCell attachment indicator', () => {
  it('does not render attachment icon when count is 0', () => {
    render(<NotesCell hasValue excerpt="x" rawValue="x" onOpen={() => {}} attachmentCount={0} />);
    expect(screen.queryByLabelText(/Foto in Notizen|Fotos in Notizen/)).not.toBeInTheDocument();
  });


  it('opens notes drawer when clicking anywhere in the notes cell', () => {
    const onOpen = vi.fn();
    render(<NotesCell hasValue excerpt="Meine Notiz" rawValue="Meine Notiz" onOpen={onOpen} attachmentCount={0} />);

    fireEvent.click(screen.getByText('Meine Notiz'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens notes drawer via keyboard on container', () => {
    const onOpen = vi.fn();
    render(<NotesCell hasValue excerpt="Meine Notiz" rawValue="Meine Notiz" onOpen={onOpen} attachmentCount={0} />);

    const cellButton = screen.getByText('Meine Notiz').closest('[role="button"]');
    expect(cellButton).not.toBeNull();
    fireEvent.keyDown(cellButton!, { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders attachment icon when count > 0 and click does not bubble', () => {
    const onOpenAttachments = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <NotesCell hasValue excerpt="x" rawValue="x" onOpen={() => {}} attachmentCount={2} onOpenAttachments={onOpenAttachments} />
      </div>
    );

    const button = screen.getByLabelText('2 Fotos in Notizen');
    fireEvent.click(button);

    expect(onOpenAttachments).toHaveBeenCalledTimes(1);
    expect(parentClick).toHaveBeenCalledTimes(0);
  });
});
