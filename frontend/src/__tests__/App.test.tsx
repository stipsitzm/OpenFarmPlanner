import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders navigation', () => {
    render(<App />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Cultures')).toBeInTheDocument();
    expect(screen.getByText('Beds')).toBeInTheDocument();
  });

  it('renders home page by default', () => {
    render(<App />);
    
    expect(screen.getByText('CSA Farm Planner')).toBeInTheDocument();
  });
});
