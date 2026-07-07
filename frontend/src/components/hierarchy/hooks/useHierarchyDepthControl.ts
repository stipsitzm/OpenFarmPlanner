import { useCallback, useMemo } from 'react';
import {
  collectExpandedIdsUpToDepth,
  computeActiveDepthLevel,
  getTreeLevelCount,
  type TreeRowNode,
} from '../utils/treeRows';

/**
 * Backs the shared "Tiefe" (depth) control for hierarchical tree views.
 * Domain-agnostic: works off any {id, parentId} node list, so the same hook
 * serves every Standort/Parzelle/Beet tree (and any future tree) without
 * duplicating the level-count / active-level / select-level logic per page.
 */
export function useHierarchyDepthControl<T extends TreeRowNode>(
  nodes: readonly T[],
  expandedIds: ReadonlySet<string | number>,
  expandAll: (ids: (string | number)[]) => void,
) {
  const levelCount = useMemo(() => getTreeLevelCount(nodes), [nodes]);

  const activeLevel = useMemo(
    () => (nodes.length > 0 ? computeActiveDepthLevel(nodes, expandedIds, levelCount) : null),
    [nodes, expandedIds, levelCount],
  );

  const onSelectLevel = useCallback((level: number) => {
    expandAll(Array.from(collectExpandedIdsUpToDepth(nodes, level - 1)));
  }, [nodes, expandAll]);

  return { levelCount, activeLevel, onSelectLevel };
}
