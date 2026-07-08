import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHierarchyLevelToggle } from '../components/hierarchy/hooks/useHierarchyLevelToggle';
import type { TreeRowNode } from '../components/hierarchy/utils/treeRows';

const threeLevelNodes: TreeRowNode[] = [
  { id: 'loc-1', parentId: null },
  { id: 'field-1', parentId: 'loc-1' },
  { id: 'bed-1', parentId: 'field-1' },
];

const twoLevelNodes: TreeRowNode[] = [
  { id: 'field-1', parentId: null },
  { id: 'bed-1', parentId: 'field-1' },
];

describe('useHierarchyLevelToggle', () => {
  it('reports 3 levels and allows expanding but not collapsing when nothing is expanded', () => {
    const { result } = renderHook(() => useHierarchyLevelToggle(threeLevelNodes, new Set(), vi.fn()));
    expect(result.current.levelCount).toBe(3);
    expect(result.current.canExpand).toBe(true);
    expect(result.current.canCollapse).toBe(false);
  });

  it('degrades to 2 levels for a tree without a location level', () => {
    const { result } = renderHook(() => useHierarchyLevelToggle(twoLevelNodes, new Set(), vi.fn()));
    expect(result.current.levelCount).toBe(2);
  });

  it('expandOneLevel() reveals exactly the next level', () => {
    const expandAll = vi.fn();
    const { result, rerender } = renderHook(
      ({ expandedIds }) => useHierarchyLevelToggle(threeLevelNodes, expandedIds, expandAll),
      { initialProps: { expandedIds: new Set<string | number>() } },
    );

    result.current.expandOneLevel();
    expect(expandAll).toHaveBeenCalledWith(['loc-1']);

    rerender({ expandedIds: new Set(expandAll.mock.calls[0][0] as string[]) });
    expect(result.current.canExpand).toBe(true);
    expect(result.current.canCollapse).toBe(true);

    result.current.expandOneLevel();
    expect(expandAll).toHaveBeenLastCalledWith(['loc-1', 'field-1']);

    rerender({ expandedIds: new Set(expandAll.mock.calls[1][0] as string[]) });
    expect(result.current.canExpand).toBe(false);
    expect(result.current.canCollapse).toBe(true);
  });

  it('collapseOneLevel() hides exactly the deepest visible level', () => {
    const expandAll = vi.fn();
    const fullyExpanded = new Set<string | number>(['loc-1', 'field-1']);
    const { result, rerender } = renderHook(
      ({ expandedIds }) => useHierarchyLevelToggle(threeLevelNodes, expandedIds, expandAll),
      { initialProps: { expandedIds: fullyExpanded } },
    );

    result.current.collapseOneLevel();
    expect(expandAll).toHaveBeenCalledWith(['loc-1']);

    rerender({ expandedIds: new Set(expandAll.mock.calls[0][0] as string[]) });
    expect(result.current.canCollapse).toBe(true);

    result.current.collapseOneLevel();
    expect(expandAll).toHaveBeenLastCalledWith([]);

    rerender({ expandedIds: new Set(expandAll.mock.calls[1][0] as string[]) });
    expect(result.current.canCollapse).toBe(false);
  });

  it('disables both toggles for an empty node list (no tree to control)', () => {
    const { result } = renderHook(() => useHierarchyLevelToggle([], new Set(), vi.fn()));
    expect(result.current.levelCount).toBe(1);
    expect(result.current.canExpand).toBe(false);
    expect(result.current.canCollapse).toBe(false);
  });
});
