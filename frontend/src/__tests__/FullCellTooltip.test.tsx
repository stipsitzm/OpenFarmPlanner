import { fireEvent, render, screen } from '@testing-library/react';
import { Box } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { FullCellTooltip } from '../components/data-grid/FullCellTooltip';

describe('FullCellTooltip', () => {
  it('uses the full parent cell area as its hover target', async () => {
    const { container } = render(
      <Box sx={{ position: 'relative', width: 160, height: 44 }}>
        <FullCellTooltip title="Unavailable value">
          <span>—</span>
        </FullCellTooltip>
      </Box>,
    );

    const trigger = container.querySelector('.ofp-full-cell-tooltip-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger).toHaveStyle({ position: 'absolute', inset: '0' });

    fireEvent.mouseOver(trigger as Element);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Unavailable value');
  });

  it('opens when its DataGrid cell owns keyboard focus', async () => {
    render(
      <Box sx={{ position: 'relative', width: 160, height: 44 }}>
        <FullCellTooltip title="Unavailable value" cellHasFocus>
          <span>—</span>
        </FullCellTooltip>
      </Box>,
    );

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Unavailable value');
  });
});
