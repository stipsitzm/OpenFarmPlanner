import { useEffect, useMemo, useState } from 'react';

const ENRICHMENT_LOADING_STEPS = [
  { key: 'request', startSeconds: 0 },
  { key: 'research', startSeconds: 12 },
  { key: 'validation', startSeconds: 32 },
  { key: 'results', startSeconds: 52 },
] as const;

const ENRICHMENT_EXPECTED_SECONDS = 75;

export const useEnrichmentLoadingProgress = (isLoading: boolean) => {
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null);
  const [loadingNow, setLoadingNow] = useState<number>(Date.now());

  useEffect(() => {
    if (!isLoading) {
      setLoadingStartedAt(null);
      return;
    }

    const startedAt = Date.now();
    setLoadingStartedAt(startedAt);
    setLoadingNow(startedAt);

    const intervalId = window.setInterval(() => {
      setLoadingNow(Date.now());
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  return useMemo(() => {
    const elapsedSeconds = loadingStartedAt
      ? Math.max(0, Math.floor((loadingNow - loadingStartedAt) / 1000))
      : 0;
    const progressPercent = Math.min(95, Math.round((elapsedSeconds / ENRICHMENT_EXPECTED_SECONDS) * 100));
    const activeStepIndex = ENRICHMENT_LOADING_STEPS.reduce((lastIndex, step, index) => (
      elapsedSeconds >= step.startSeconds ? index : lastIndex
    ), 0);

    return {
      steps: ENRICHMENT_LOADING_STEPS,
      elapsedSeconds,
      progressPercent,
      activeStepIndex,
    };
  }, [loadingNow, loadingStartedAt]);
};
