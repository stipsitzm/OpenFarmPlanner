import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import translations from '@/test-utils/translations';

describe('App', () => {
  it('renders navigation', () => {
    render(<CommandProvider><App /></CommandProvider>);
    
    expect(screen.getByText(translations.navigation.start)).toBeInTheDocument();
    expect(screen.getByText(translations.navigation.locations)).toBeInTheDocument();
    expect(screen.getByText(translations.navigation.cultures)).toBeInTheDocument();
    expect(screen.getByText(translations.fields.plots)).toBeInTheDocument();
    expect(screen.getByLabelText(`${translations.navigation.cultures} (Alt+Shift+C)`)).toBeInTheDocument();
  });

  it('renders home page by default', () => {
    render(<CommandProvider><App /></CommandProvider>);
    
    expect(screen.getByText(translations.app.title)).toBeInTheDocument();
  });
});
