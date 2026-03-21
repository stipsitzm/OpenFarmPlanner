import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FieldsBedsPage from '../pages/FieldsBedsPage';

vi.mock('../pages/FieldsBedsHierarchy', () => ({
  default: () => <div>Hierarchieansicht</div>,
}));

vi.mock('../pages/GraphicalFields', () => ({
  default: () => <div>Editiermodus</div>,
}));

vi.mock('../commands/CommandProvider', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
}));

describe('FieldsBedsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the edit mode switch only when graphical view is active', () => {
    render(<FieldsBedsPage />);

    expect(screen.getByText('Hierarchieansicht')).toBeInTheDocument();
    expect(screen.queryByText('Editiermodus')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch'));

    expect(screen.getByText('Editiermodus')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch'));

    expect(screen.getByText('Hierarchieansicht')).toBeInTheDocument();
    expect(screen.queryByText('Editiermodus')).not.toBeInTheDocument();
  });
});
