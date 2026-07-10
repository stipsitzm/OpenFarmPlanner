import { useCallback, useRef, useState } from 'react';
import { focusContextMenuOrigin, useContextMenuFocus } from '../data-grid/contextMenuFocus';
import { useCloseCustomContextMenuOnNativeContextMenu } from '../../utils/contextMenu';

export interface RowContextMenuState<TKey> {
  key: TKey;
  mouseX: number;
  mouseY: number;
}

export interface UseRowContextMenuStateParams {
  /** Whether an event target belongs to a row this menu can open for. Gates
   * the "close this menu if a native context menu opens elsewhere" listener. */
  isContextMenuTarget: (target: EventTarget | null) => boolean;
}

/**
 * Shared open/close/reposition state machine behind both EditableDataGrid's
 * row-action menu (useDataGridRowActionMenu) and FieldsBedsHierarchy's
 * context menu (useHierarchyContextMenu) — see
 * docs/datagrid-architecture.md ("Hover actions / row actions / context
 * menu"). `TKey` is whatever the caller wants to identify the target row by
 * (a row id looked up later, or the row object itself); this hook doesn't
 * care which, it only manages position, focus-restore-on-close, and
 * dismissal when another context menu opens elsewhere.
 */
export function useRowContextMenuState<TKey>({
  isContextMenuTarget,
}: UseRowContextMenuStateParams) {
  const [state, setState] = useState<RowContextMenuState<TKey> | null>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const open = useCallback((
    key: TKey,
    mouseX: number,
    mouseY: number,
    origin?: HTMLElement | null,
  ): void => {
    originRef.current = origin ?? null;
    setState({ key, mouseX, mouseY });
  }, []);

  const close = useCallback((): void => {
    setState(null);
    focusContextMenuOrigin(originRef.current);
  }, []);

  /** Clears the menu without restoring focus, only if it's currently showing
   * a key matching `predicate` — for silently dropping the menu when its
   * underlying row disappears (e.g. deleted), as opposed to a user-driven
   * close which should return focus to whatever opened the menu. */
  const clearIf = useCallback((predicate: (key: TKey) => boolean): void => {
    setState((current) => (current && predicate(current.key) ? null : current));
  }, []);

  const reposition = useCallback((event: globalThis.MouseEvent): void => {
    setState((current) => (
      current ? { key: current.key, mouseX: event.clientX + 2, mouseY: event.clientY - 6 } : current
    ));
  }, []);

  useCloseCustomContextMenuOnNativeContextMenu(
    state !== null,
    close,
    isContextMenuTarget,
    reposition,
  );

  const listRef = useContextMenuFocus(state !== null, close);

  return { state, originRef, listRef, open, close, clearIf };
}
