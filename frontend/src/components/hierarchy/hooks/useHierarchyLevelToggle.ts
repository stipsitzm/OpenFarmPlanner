import { useCallback, useMemo } from 'react';
import {
  collectExpandedIdsUpToDepth,
  computeExpandedDepthLevel,
  getTreeLevelCount,
  type TreeRowNode,
} from '../utils/treeRows';

/**
 * Backs the shared "expand one level" / "collapse one level" toolbar toggle
 * for hierarchical tree views. Domain-agnostic: works off any {id, parentId}
 * node list, so the same hook serves every Standort/Parzelle/Beet tree (and
 * any future tree) without duplicating the level-count / step logic per page.
 *
 * Unlike a fixed set of "jump to depth N" buttons, this steps relative to
 * the tree's current expansion state, so it works the same way regardless
 * of how many levels a project's hierarchy actually has.
 */
export function useHierarchyLevelToggle<T extends TreeRowNode>(
  nodes: readonly T[],
  expandedIds: ReadonlySet<string | number>,
  expandAll: (ids: (string | number)[]) => void,
) {
  const levelCount = useMemo(() => getTreeLevelCount(nodes), [nodes]);

  const currentLevel = useMemo(
    () => computeExpandedDepthLevel(nodes, expandedIds, levelCount),
    [nodes, expandedIds, levelCount],
  );

  const expandOneLevel = useCallback(() => {
    expandAll(Array.from(collectExpandedIdsUpToDepth(nodes, currentLevel)));
  }, [nodes, expandAll, currentLevel]);

  const collapseOneLevel = useCallback(() => {
    expandAll(Array.from(collectExpandedIdsUpToDepth(nodes, Math.max(0, currentLevel - 2))));
  }, [nodes, expandAll, currentLevel]);

  return {
    levelCount,
    canExpand: levelCount >= 2 && currentLevel < levelCount,
    canCollapse: levelCount >= 2 && currentLevel > 1,
    expandOneLevel,
    collapseOneLevel,
  };
}
