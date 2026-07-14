import { useEffect } from 'react';
import type { TopbarContextAction } from '../navigation/topbarTypes';

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
