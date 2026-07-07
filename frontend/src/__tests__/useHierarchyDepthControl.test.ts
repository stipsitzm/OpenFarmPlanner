import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHierarchyDepthControl } from '../components/hierarchy/hooks/useHierarchyDepthControl';
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

describe('useHierarchyDepthControl', () => {
  it('reports 3 levels and level 1 (nothing expanded) as active for an empty expanded set', () => {
    const { result } = renderHook(() => useHierarchyDepthControl(threeLevelNodes, new Set(), vi.fn()));
    expect(result.current.levelCount).toBe(3);
    expect(result.current.activeLevel).toBe(1);
  });

  it('degrades to 2 levels for a tree without a location level', () => {
    const { result } = renderHook(() => useHierarchyDepthControl(twoLevelNodes, new Set(), vi.fn()));
    expect(result.current.levelCount).toBe(2);
  });

  it('onSelectLevel(N) expands exactly the ids that make level N active', () => {
    const expandAll = vi.fn();
    const { result, rerender } = renderHook(
      ({ expandedIds }) => useHierarchyDepthControl(threeLevelNodes, expandedIds, expandAll),
      { initialProps: { expandedIds: new Set<string | number>() } },
    );

    result.current.onSelectLevel(2);
    expect(expandAll).toHaveBeenCalledWith(['loc-1']);

    rerender({ expandedIds: new Set(expandAll.mock.calls[0][0] as string[]) });
    expect(result.current.activeLevel).toBe(2);
  });

  it('returns null active level for an empty node list (no tree to control)', () => {
    const { result } = renderHook(() => useHierarchyDepthControl([], new Set(), vi.fn()));
    expect(result.current.activeLevel).toBe(null);
  });
});
