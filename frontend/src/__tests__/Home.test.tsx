import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';

describe('Home Page', () => {
  it('renders home page with title', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    expect(screen.getByText('CSA Farm Planner')).toBeInTheDocument();
  });

  it('displays quick links', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Manage Cultures')).toBeInTheDocument();
    expect(screen.getByText('Manage Beds')).toBeInTheDocument();
    expect(screen.getByText('Manage Planting Plans')).toBeInTheDocument();
  });
});
