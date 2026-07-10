import { useCallback, useEffect, useRef } from 'react';

/**
 * Minimal touch-long-press timer: start(fire) (re)arms a single timeout,
 * clear() cancels it, and the timer is always cancelled on unmount. Callers
 * own their own touch-target validation before calling start() - this hook
 * only manages the timer lifecycle, not what counts as a valid long-press
 * target.
 */
export function useLongPressTimer(durationMs: number) {
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clear = useCallback((): void => {
    if (timerRef.current === null) {
      return;
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => clear(), [clear]);

  const start = useCallback((fire: () => void): void => {
    clear();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      fire();
    }, durationMs);
  }, [clear, durationMs]);

  return { start, clear };
}
