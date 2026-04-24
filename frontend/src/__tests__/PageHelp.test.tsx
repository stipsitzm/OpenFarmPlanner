import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageHelp from '../components/help/PageHelp';

describe('PageHelp', () => {
  it('renders the page introduction as body text before structured sections', async () => {
    render(<PageHelp pageKey="plantingPlans" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe anzeigen' }));

    const intro = await screen.findByText(
      'Hier planst du, welche Kultur wann auf welchem Beet angebaut wird. Die Seite verbindet deine Anbauflächen mit den Kulturdaten und bildet die Grundlage für Anbaukalender und Saatgutbedarf.',
    );

    expect(screen.queryByText('Was sehe ich hier?')).not.toBeInTheDocument();
    expect(screen.queryByText(`• ${intro.textContent}`)).not.toBeInTheDocument();
    expect(screen.getByText('Bedienung')).toBeInTheDocument();
    expect(screen.getByText('Zusammenhang mit anderen Seiten')).toBeInTheDocument();
  });
});
