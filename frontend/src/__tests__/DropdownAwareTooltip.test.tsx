import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button } from '@mui/material';
import { DropdownAwareTooltip } from '../components/DropdownAwareTooltip';

describe('DropdownAwareTooltip', () => {
  it('hides immediately when a dropdown trigger is opened', async () => {
    render(
      <DropdownAwareTooltip title="Hilfetext" open>
        <Button role="combobox" aria-haspopup="listbox">
          Einheit
        </Button>
      </DropdownAwareTooltip>
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('Hilfetext');

    fireEvent.mouseDown(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
