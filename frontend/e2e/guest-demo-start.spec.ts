import { expect, test } from '@playwright/test';

test('starts the public guest demo and keeps the user in the app', async ({ page }) => {
  let releaseStartupRefresh: () => void = () => {};
  const startupRefreshReleased = new Promise<void>((resolve) => {
    releaseStartupRefresh = resolve;
  });
  let resolveStartupRefreshStarted: () => void = () => {};
  const startupRefreshStarted = new Promise<void>((resolve) => {
    resolveStartupRefreshStarted = resolve;
  });

  await page.route('**/api/auth/me/', async (route) => {
    resolveStartupRefreshStarted();
    await startupRefreshReleased;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
    });
  }, { times: 1 });

  await page.goto('/');
  await startupRefreshStarted;

  await page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' }).click();

  await expect(page).toHaveURL(/\/app\/fields-beds/);
  releaseStartupRefresh();

  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page.getByRole('heading', { name: 'Anbauflächen' })).toBeVisible();
});
