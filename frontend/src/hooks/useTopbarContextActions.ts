import { useEffect } from 'react';
import type { TopbarContextAction } from '../navigation/topbarTypes';

export function useTopbarContextActions(
  setActions: ((actions: TopbarContextAction[]) => void) | undefined,
  actions: TopbarContextAction[],
): void {
  useEffect(() => {
    if (!setActions) {
      return;
    }

    setActions(actions);
  }, [actions, setActions]);

  useEffect(() => {
    if (!setActions) {
      return undefined;
    }

    return () => setActions([]);
  }, [setActions]);
}
