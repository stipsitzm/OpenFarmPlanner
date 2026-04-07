import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FieldsBedsPage from '../pages/FieldsBedsPage';

vi.mock('../pages/FieldsBedsHierarchy', () => ({
  default: () => <div>Hierarchieansicht</div>,
}));

vi.mock('../pages/GraphicalFields', () => ({
  default: () => <div>Editiermodus</div>,
}));

vi.mock('../commands/useCommandContext', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
}));

describe('FieldsBedsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('switches between hierarchy and graphical view via representation buttons', () => {
    render(<FieldsBedsPage />);

    expect(screen.getByText('Hierarchieansicht')).toBeInTheDocument();
    expect(screen.queryByText('Editiermodus')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Grafik' }));

    expect(screen.getByText('Editiermodus')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Liste' }));

    expect(screen.getByText('Hierarchieansicht')).toBeInTheDocument();
    expect(screen.queryByText('Editiermodus')).not.toBeInTheDocument();
  });
});
