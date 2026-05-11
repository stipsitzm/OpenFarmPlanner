import { useEffect } from 'react';
import type { TopbarContextAction } from '../App';

export function useTopbarContextActions(
  setActions: (actions: TopbarContextAction[]) => void,
  actions: TopbarContextAction[],
): void {
  useEffect(() => {
    setActions(actions);
    return () => setActions([]);
  }, [actions, setActions]);
}
