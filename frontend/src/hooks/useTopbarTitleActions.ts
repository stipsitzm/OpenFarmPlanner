import { useEffect } from 'react';
import type { TopbarContextAction } from '../App';

export function useTopbarTitleActions(
  setActions: ((actions: TopbarContextAction[]) => void) | undefined,
  actions: TopbarContextAction[],
): void {
  useEffect(() => {
    if (!setActions) {
      return undefined;
    }
    setActions(actions);
    return () => setActions([]);
  }, [setActions, actions]);
}
