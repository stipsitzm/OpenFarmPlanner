import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RuntimeErrorState from '../components/runtime/RuntimeErrorState';

describe('RuntimeErrorState', () => {
  it('shows a minimal route fallback without a manual reload action', () => {
    render(<RuntimeErrorState variant="routeError" />);

    expect(screen.getByText('Die Seite konnte nicht automatisch wiederhergestellt werden. Bitte versuche es später erneut.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seite neu laden' })).not.toBeInTheDocument();
    expect(screen.queryByText('Die Seite konnte nicht geladen werden.')).not.toBeInTheDocument();
  });
});
