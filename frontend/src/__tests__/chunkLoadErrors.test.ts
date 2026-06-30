import { beforeEach, describe, expect, it } from 'vitest';
import { shouldAutomaticallyReloadForRouteLoadError } from '../runtime/chunkLoadErrors';

describe('route load error recovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows one automatic reload per route', () => {
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(false);
  });

  it('tracks retries independently for each route', () => {
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/fields-beds')).toBe(true);
    expect(shouldAutomaticallyReloadForRouteLoadError('/app/gantt-chart')).toBe(false);
  });
});
