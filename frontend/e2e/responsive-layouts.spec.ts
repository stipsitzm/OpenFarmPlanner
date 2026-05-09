import { expect, test } from '@playwright/test';
import { loginWithDeterministicProject, MAIN_ROUTES, setViewportPreset, VIEWPORTS, waitForPageStable } from './utils';

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
        });
      }
    });
  }
});
