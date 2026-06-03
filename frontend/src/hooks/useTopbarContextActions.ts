import { useEffect } from 'react';
import type { TopbarContextAction } from '../App';

const NOOP_SET_TOPBAR_ACTIONS = (_actions: TopbarContextAction[]): void => undefined;

export function useTopbarContextActions(
  setActions: ((actions: TopbarContextAction[]) => void) | undefined,
  actions: TopbarContextAction[],
): void {
  const resolvedSetActions = setActions ?? NOOP_SET_TOPBAR_ACTIONS;

  useEffect(() => {
    resolvedSetActions(actions);
  }, [actions, resolvedSetActions]);

  useEffect(() => () => resolvedSetActions([]), [resolvedSetActions]);
}
