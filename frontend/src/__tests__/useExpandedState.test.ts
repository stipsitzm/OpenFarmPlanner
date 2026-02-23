import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpandedState } from '../components/hierarchy/hooks/useExpandedState';

describe('useExpandedState', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

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

  it('hydrates expansion state from session storage when a storage key is provided', () => {
    window.sessionStorage.setItem('hierarchyExpanded.fieldsBedsHierarchy', JSON.stringify(['location-1', 'field-3']));

    const { result } = renderHook(() => useExpandedState('fieldsBedsHierarchy'));

    expect(result.current.hasPersistedState).toBe(true);
    expect(Array.from(result.current.expandedRows)).toEqual(['location-1', 'field-3']);
  });

  it('persists expansion updates to session storage', () => {
    const { result } = renderHook(() => useExpandedState('fieldsBedsHierarchy'));

    act(() => result.current.ensureExpanded('location-2'));

    expect(
      JSON.parse(window.sessionStorage.getItem('hierarchyExpanded.fieldsBedsHierarchy') ?? '[]')
    ).toEqual(['location-2']);
  });
});
