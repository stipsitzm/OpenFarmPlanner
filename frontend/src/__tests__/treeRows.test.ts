import { describe, expect, it } from 'vitest';
import {
  collectVisibleIdsWithAncestors,
  flattenTreeRows,
  type TreeRowNode,
} from '../components/hierarchy/utils/treeRows';

interface TestNode extends TreeRowNode {
  name: string;
}

const nodes: TestNode[] = [
  { id: 'loc-1', parentId: null, name: 'Standort A' },
  { id: 'field-1', parentId: 'loc-1', name: 'Parzelle 1' },
  { id: 'bed-1', parentId: 'field-1', name: 'Beet 1' },
  { id: 'bed-2', parentId: 'field-1', name: 'Beet 2' },
  { id: 'field-2', parentId: 'loc-1', name: 'Parzelle 2' },
  { id: 'bed-3', parentId: 'field-2', name: 'Beet 3' },
  { id: 'loc-2', parentId: null, name: 'Standort B' },
  { id: 'field-3', parentId: 'loc-2', name: 'Parzelle 3' },
];

describe('flattenTreeRows', () => {
  it('converts a nested tree into correctly ordered, depth-annotated rows when fully expanded', () => {
    const expandedIds = new Set(nodes.map((n) => n.id));
    const rows = flattenTreeRows(nodes, { expandedIds });

    expect(rows.map((r) => r.node.id)).toEqual([
      'loc-1', 'field-1', 'bed-1', 'bed-2', 'field-2', 'bed-3', 'loc-2', 'field-3',
    ]);
    expect(rows.find((r) => r.node.id === 'loc-1')?.depth).toBe(0);
    expect(rows.find((r) => r.node.id === 'field-1')?.depth).toBe(1);
    expect(rows.find((r) => r.node.id === 'bed-1')?.depth).toBe(2);
  });

  it('reports hasChildren correctly for parents and leaves', () => {
    const expandedIds = new Set(nodes.map((n) => n.id));
    const rows = flattenTreeRows(nodes, { expandedIds });

    expect(rows.find((r) => r.node.id === 'loc-1')?.hasChildren).toBe(true);
    expect(rows.find((r) => r.node.id === 'bed-1')?.hasChildren).toBe(false);
  });

  it('collapse hides children: a collapsed node is shown but its descendants are omitted', () => {
    const expandedIds = new Set(['loc-1', 'loc-2', 'field-2']); // field-1 collapsed
    const rows = flattenTreeRows(nodes, { expandedIds });

    const ids = rows.map((r) => r.node.id);
    expect(ids).toContain('field-1');
    expect(ids).not.toContain('bed-1');
    expect(ids).not.toContain('bed-2');
    // sibling branch under field-2 (expanded) still shows its children
    expect(ids).toContain('bed-3');
  });

  it('expand reveals children again after being collapsed', () => {
    const collapsed = new Set(['loc-1', 'loc-2']);
    const collapsedRows = flattenTreeRows(nodes, { expandedIds: collapsed });
    expect(collapsedRows.map((r) => r.node.id)).not.toContain('bed-1');

    const expanded = new Set(['loc-1', 'loc-2', 'field-1', 'field-2']);
    const expandedRows = flattenTreeRows(nodes, { expandedIds: expanded });
    expect(expandedRows.map((r) => r.node.id)).toContain('bed-1');
  });

  it('an empty expandedIds set only shows root-level rows', () => {
    const rows = flattenTreeRows(nodes, { expandedIds: new Set() });
    expect(rows.map((r) => r.node.id)).toEqual(['loc-1', 'loc-2']);
  });

  it('with a visibleIds filter, only matched nodes are shown and expandedIds is ignored (full path to matches revealed)', () => {
    const matched = new Set(['bed-1']);
    const visibleIds = collectVisibleIdsWithAncestors(nodes, matched);
    // even with nothing manually expanded, filtering reveals the full ancestor chain
    const rows = flattenTreeRows(nodes, { expandedIds: new Set(), visibleIds });

    expect(rows.map((r) => r.node.id)).toEqual(['loc-1', 'field-1', 'bed-1']);
  });
});

describe('collectVisibleIdsWithAncestors', () => {
  it('includes the matched node and every ancestor up to the root', () => {
    const visible = collectVisibleIdsWithAncestors(nodes, new Set(['bed-3']));
    expect(visible).toEqual(new Set(['bed-3', 'field-2', 'loc-1']));
  });

  it('deduplicates shared ancestors across multiple matches', () => {
    const visible = collectVisibleIdsWithAncestors(nodes, new Set(['bed-1', 'bed-3']));
    expect(visible).toEqual(new Set(['bed-1', 'field-1', 'loc-1', 'bed-3', 'field-2']));
  });

  it('returns an empty set when nothing matches', () => {
    const visible = collectVisibleIdsWithAncestors(nodes, new Set());
    expect(visible.size).toBe(0);
  });
});
