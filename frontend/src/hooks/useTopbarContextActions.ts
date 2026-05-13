import { useEffect, useRef } from 'react';
import type { TopbarContextAction } from '../App';

export function useTopbarContextActions(
  setActions: (actions: TopbarContextAction[]) => void,
  actions: TopbarContextAction[],
): void {
  const lastSignatureRef = useRef<string>('');

  useEffect(() => {
    const signature = JSON.stringify(
      actions.map((action) => ({
        id: action.id,
        label: action.label,
        ariaLabel: action.ariaLabel,
        disabled: Boolean(action.disabled),
        active: Boolean(action.active),
        hidden: Boolean(action.hidden),
        groupId: action.groupId ?? '',
        tooltip: action.tooltip ?? '',
      })),
    );
    if (signature === lastSignatureRef.current) {
      return;
    }
    lastSignatureRef.current = signature;
    setActions(actions);
  }, [actions, setActions]);

  useEffect(() => () => setActions([]), [setActions]);
}
