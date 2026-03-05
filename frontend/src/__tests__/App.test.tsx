import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import translations from '@/test-utils/translations';

describe('App', () => {
  it('renders navigation', async () => {
    render(<CommandProvider><App /></CommandProvider>);

    expect(await screen.findByText(translations.navigation.locations)).toBeInTheDocument();
    expect(screen.getByText(translations.navigation.cultures)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translations.navigation.plantingPlans })).toBeInTheDocument();
    expect(screen.getByText(translations.fields.plots)).toBeInTheDocument();
    expect(screen.queryByText(translations.navigation.start)).not.toBeInTheDocument();
  });

  it('renders planting plans page by default', async () => {
    render(<CommandProvider><App /></CommandProvider>);

    expect((await screen.findAllByText('Anbaupläne')).length).toBeGreaterThan(0);
  });
});
