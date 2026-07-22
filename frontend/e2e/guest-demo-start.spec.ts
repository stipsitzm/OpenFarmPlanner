import { expect, test } from '@playwright/test';

test('starts the public guest demo and keeps the user in the app', async ({ page }) => {
  let publicAuthProbeCount = 0;

  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/me/')) {
      publicAuthProbeCount += 1;
    }
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' })).toBeVisible();
  expect(publicAuthProbeCount).toBe(0);

  await page.getByRole('button', { name: 'Demo ohne Registrierung ansehen' }).click();

  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page).toHaveURL(/\/app\/fields-beds/);
  await expect(page.getByRole('heading', { name: 'Anbauflächen' })).toBeVisible();
});
