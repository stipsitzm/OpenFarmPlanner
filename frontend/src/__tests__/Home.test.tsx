import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';
import translations from '@/test-utils/translations';

describe('Home Page', () => {
  it('renders home page with title', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    expect(screen.getByText(translations.app.title)).toBeInTheDocument();
  });

  it('displays quick links', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
    
    expect(screen.getByText(translations.home.manageCultures)).toBeInTheDocument();
    expect(screen.getByText(translations.home.manageBeds)).toBeInTheDocument();
    expect(screen.getByText(translations.home.managePlantingPlans)).toBeInTheDocument();
  });
});
