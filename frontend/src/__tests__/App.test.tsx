import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders navigation', () => {
    render(<App />);
    
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Standorte')).toBeInTheDocument();
    expect(screen.getByText('Kulturen')).toBeInTheDocument();
    expect(screen.getByText('Beete')).toBeInTheDocument();
  });

  it('renders home page by default', () => {
    render(<App />);
    
    expect(screen.getByText('CSA Farm Planner')).toBeInTheDocument();
  });
});
