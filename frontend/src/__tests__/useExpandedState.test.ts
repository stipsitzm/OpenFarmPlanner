import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';

describe('useExpandedState', () => {
  it('toggles rows in expanded set', () => {
    const { result } = renderHook(() => useExpandedState());

    act(() => result.current.toggleExpand('field-1'));
    expect(result.current.expandedRows.has('field-1')).toBe(true);

    act(() => result.current.toggleExpand('field-1'));
    expect(result.current.expandedRows.has('field-1')).toBe(false);
  });

  it('ensures rows are expanded and can expand all', () => {
    const { result } = renderHook(() => useExpandedState());

    act(() => result.current.ensureExpanded('location-1'));
    expect(result.current.expandedRows.has('location-1')).toBe(true);

    act(() => result.current.expandAll(['field-1', 'field-2', 99]));
    expect(Array.from(result.current.expandedRows)).toEqual(['field-1', 'field-2', 99]);
  });
});
