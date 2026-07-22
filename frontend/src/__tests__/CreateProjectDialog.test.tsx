import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FormEvent } from 'react';
import { CreateProjectDialog } from '../navigation/CreateProjectDialog';

describe('CreateProjectDialog', () => {
  it('focuses the project name field on open and selects a prefilled name', () => {
    render(
      <CreateProjectDialog
        open
        name="Alpha"
        onNameChange={vi.fn()}
        isCreating={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Projektname' }) as HTMLInputElement;

    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Alpha'.length);
  });

  it('keeps Enter submit and Escape close behavior available', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <CreateProjectDialog
        open
        name="Alpha"
        onNameChange={vi.fn()}
        isCreating={false}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Projektname' });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
