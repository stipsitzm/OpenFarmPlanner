import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotesCell } from '../components/data-grid/NotesCell';

describe('NotesCell preview popover triggers (compact indicator)', () => {
  it('opens the editor directly on a plain mouse click', () => {
    const onOpen = vi.fn();
    render(
      <NotesCell hasValue excerpt="Meine Notiz" rawValue="Meine Notiz" onOpen={onOpen} attachmentCount={0} compactIndicator />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('requests the preview to open (hover mode) on mouse enter and to close on mouse leave', () => {
    const onPreviewOpen = vi.fn();
    const onPreviewClose = vi.fn();
    render(
      <NotesCell
        hasValue
        excerpt="Meine Notiz"
        rawValue="Meine Notiz"
        onOpen={() => {}}
        attachmentCount={0}
        compactIndicator
        onPreviewOpen={onPreviewOpen}
        onPreviewClose={onPreviewClose}
      />,
    );

    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);
    expect(onPreviewOpen).toHaveBeenCalledTimes(1);
    expect(onPreviewOpen).toHaveBeenCalledWith(trigger, 'hover');

    fireEvent.mouseLeave(trigger);
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
  });

  it('requests the preview to open immediately on keyboard focus and to close on blur', () => {
    const onPreviewOpen = vi.fn();
    const onPreviewClose = vi.fn();
    render(
      <NotesCell
        hasValue
        excerpt="Meine Notiz"
        rawValue="Meine Notiz"
        onOpen={() => {}}
        attachmentCount={0}
        compactIndicator
        onPreviewOpen={onPreviewOpen}
        onPreviewClose={onPreviewClose}
      />,
    );

    const trigger = screen.getByRole('button');
    fireEvent.focus(trigger);
    expect(onPreviewOpen).toHaveBeenCalledWith(trigger, 'immediate');

    fireEvent.blur(trigger);
    expect(onPreviewClose).toHaveBeenCalledTimes(1);
  });

  it('first tap on touch opens the preview instead of the editor, second tap opens the editor', () => {
    const onOpen = vi.fn();
    const onPreviewOpen = vi.fn();
    const { rerender } = render(
      <NotesCell
        hasValue
        excerpt="Meine Notiz"
        rawValue="Meine Notiz"
        onOpen={onOpen}
        attachmentCount={0}
        compactIndicator
        isPreviewOpen={false}
        onPreviewOpen={onPreviewOpen}
        onPreviewClose={() => {}}
      />,
    );

    const trigger = screen.getByRole('button');
    fireEvent.touchStart(trigger);
    fireEvent.click(trigger);

    expect(onPreviewOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    // Simulate the popover now being open for this cell (as the parent would report back).
    rerender(
      <NotesCell
        hasValue
        excerpt="Meine Notiz"
        rawValue="Meine Notiz"
        onOpen={onOpen}
        attachmentCount={0}
        compactIndicator
        isPreviewOpen
        onPreviewOpen={onPreviewOpen}
        onPreviewClose={() => {}}
      />,
    );

    fireEvent.touchStart(trigger);
    fireEvent.click(trigger);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('exposes aria-haspopup and aria-expanded reflecting preview state', () => {
    render(
      <NotesCell
        hasValue
        excerpt="Meine Notiz"
        rawValue="Meine Notiz"
        onOpen={() => {}}
        attachmentCount={0}
        compactIndicator
        isPreviewOpen
        onPreviewOpen={() => {}}
        onPreviewClose={() => {}}
      />,
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
