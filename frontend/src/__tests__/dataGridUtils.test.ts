import { describe, it, expect, vi } from 'vitest';
import { GridRowEditStopReasons, GridRowModes } from '@mui/x-data-grid';
import { handleEditableCellClick, handleRowEditStop } from '../components/data-grid/handlers';
import { getPlainExcerpt, stripMarkdown } from '../components/data-grid/markdown';

describe('data-grid utility handlers', () => {
  it('enters edit mode on editable cell click when row is not already editing', () => {
    const setRowModesModel = vi.fn();

    handleEditableCellClick(
      { id: 1, field: 'name', isEditable: true } as never,
      {},
      setRowModesModel
    );

    expect(setRowModesModel).toHaveBeenCalledTimes(1);
    const updater = setRowModesModel.mock.calls[0][0] as (oldModel: Record<string, unknown>) => Record<string, unknown>;
    expect(updater({})).toEqual({
      1: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
    });
  });

  it('does not change row mode for non-editable or already-editing cells', () => {
    const setRowModesModel = vi.fn();

    handleEditableCellClick(
      { id: 1, field: 'name', isEditable: false } as never,
      {},
      setRowModesModel
    );

    handleEditableCellClick(
      { id: 1, field: 'name', isEditable: true } as never,
      { 1: { mode: GridRowModes.Edit } },
      setRowModesModel
    );

    expect(setRowModesModel).not.toHaveBeenCalled();
  });

  it('prevents default grid behavior for escape key edit stop only', () => {
    const escapeEvent = { defaultMuiPrevented: false } as { defaultMuiPrevented: boolean };
    handleRowEditStop(
      { reason: GridRowEditStopReasons.escapeKeyDown } as never,
      escapeEvent as never
    );
    expect(escapeEvent.defaultMuiPrevented).toBe(true);

    const blurEvent = { defaultMuiPrevented: false } as { defaultMuiPrevented: boolean };
    handleRowEditStop(
      { reason: GridRowEditStopReasons.rowFocusOut } as never,
      blurEvent as never
    );
    expect(blurEvent.defaultMuiPrevented).toBe(false);
  });
});

describe('data-grid markdown utilities', () => {
  it('strips markdown syntax into plain text', () => {
    const markdown = `# Header\n\n**bold** and *italic* and __u__ and _i_\n\n[link](https://a.b)\n\n> quote\n\n- item\n1. num\n\n\
\
\`inline\`\n\n![img](x.png)`;

    const plain = stripMarkdown(markdown);

    expect(plain).toContain('Header');
    expect(plain).toContain('bold and italic and u and i');
    expect(plain).toContain('link');
    expect(plain).toContain('quote');
    expect(plain).toContain('item');
    expect(plain).toContain('num');
    expect(plain).toContain('inline');
    expect(plain).not.toContain('**');
    expect(plain).not.toContain('[');
  });

  it('returns empty values correctly and truncates excerpts', () => {
    expect(stripMarkdown('')).toBe('');
    expect(getPlainExcerpt('', 10)).toBe('');
    expect(getPlainExcerpt('   ', 10)).toBe('');

    const excerpt = getPlainExcerpt('Ein sehr langer Text ohne Markdown', 8);
    expect(excerpt).toBe('Ein sehr...');

    expect(getPlainExcerpt('Kurz', 10)).toBe('Kurz');
  });
});
