import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotesCell } from '../components/data-grid/NotesCell';

describe('NotesCell attachment indicator', () => {
  it('does not render attachment icon when count is 0', () => {
    render(<NotesCell hasValue excerpt="x" rawValue="x" onOpen={() => {}} attachmentCount={0} />);
    expect(screen.queryByLabelText(/Foto in Notizen|Fotos in Notizen/)).not.toBeInTheDocument();
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
