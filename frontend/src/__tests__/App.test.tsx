import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import translations from '@/test-utils/translations';

describe('App', () => {
  it('renders navigation', () => {
    render(<App />);
    
    expect(screen.getByText(translations.navigation.start)).toBeInTheDocument();
    expect(screen.getByText(translations.navigation.locations)).toBeInTheDocument();
    expect(screen.getByText(translations.navigation.cultures)).toBeInTheDocument();
    expect(screen.getByText(translations.fields.plots)).toBeInTheDocument();
  });

  it('renders home page by default', () => {
    render(<App />);
    
    expect(screen.getByText(translations.app.title)).toBeInTheDocument();
  });
});
