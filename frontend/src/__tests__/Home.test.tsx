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
    
    expect(screen.getByText('TinyFarm')).toBeInTheDocument();
  });

  it('displays quick links', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Kulturen verwalten')).toBeInTheDocument();
    expect(screen.getByText('Beete verwalten')).toBeInTheDocument();
    expect(screen.getByText('Anbaupläne verwalten')).toBeInTheDocument();
  });
});
