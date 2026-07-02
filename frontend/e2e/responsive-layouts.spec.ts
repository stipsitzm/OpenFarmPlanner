import { expect, test } from '@playwright/test';
import { loginWithDeterministicProject, MAIN_ROUTES, setViewportPreset, VIEWPORTS, waitForPageStable } from './utils';

// Screenshot tests (rather than functional assertions) because the thing under
// test is the overall page layout and breakpoint behavior across viewport
// sizes for every main route - not any single element's presence or text,
// which functional assertions can't capture holistically.
test.describe('responsive layout baselines', () => {
  test.beforeEach(async ({ page, request }, testInfo) => {
    await loginWithDeterministicProject(page, request, `responsive-${testInfo.workerIndex}`);
  });

  for (const viewport of VIEWPORTS) {
    test(`captures main routes at ${viewport.key}`, async ({ page }) => {
      await setViewportPreset(page, viewport);
      for (const route of MAIN_ROUTES) {
        await page.goto(route.path);
        await waitForPageStable(page, route.ready);
        await expect(page).toHaveScreenshot(`${route.key}-${viewport.key}.png`, {
          fullPage: false,
          animations: 'disabled',
          // Small tolerance for minor font-rendering/anti-aliasing differences
          // between machines (baselines are generated locally on Linux + real
          // Chrome, matching the CI runner closely but not byte-for-byte).
          maxDiffPixelRatio: 0.02,
        });
      }
    });
  }
});
