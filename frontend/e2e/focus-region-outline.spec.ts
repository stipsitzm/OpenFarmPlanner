import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { MAIN_ROUTES, waitForPageStable } from './utils';

const backendPort = process.env.BACKEND_PORT ?? '8000';
const e2eToken = process.env.E2E_TEST_TOKEN || 'openfarmplanner-e2e-token';
const apiBase = `http://127.0.0.1:${backendPort}/api`;

const ROUTE_KEYS = ['dashboard', 'kulturen', 'anbauplaene', 'saatgutbedarf', 'lieferanten'] as const;
const routes = MAIN_ROUTES.filter((route) => ROUTE_KEYS.includes(route.key));

type OutlineSnapshot = {
  boxShadow: string;
  focusRegionVisible: string | null;
  outlineColor: string;
  outlineStyle: string;
};

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }
    const text = message.text();
    if (text.includes('Failed to load resource')) {
      return;
    }
    errors.push(`console.error: ${text}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return errors;
}

async function loginWithFreshProject(
  page: Page,
  request: APIRequestContext,
  scenarioPrefix: string,
): Promise<void> {
  const scenario = `${scenarioPrefix}-${Date.now()}`;
  const setupResponse = await request.post(`${apiBase}/__e2e__/invite-flow/`, {
    headers: { 'X-E2E-Token': e2eToken },
    data: { action: 'setup', scenario_id: scenario, invitation_state: 'pending' },
  });
  const setupText = await setupResponse.text();
  expect(setupResponse.ok(), `fixture setup -> ${setupResponse.status()}: ${setupText}`).toBeTruthy();
  const setup = JSON.parse(setupText) as { admin: { email: string; password: string } };

  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(setup.admin.email);
  await page.locator('input[type="password"]').fill(setup.admin.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/app\//, { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('activeProjectId'))).toBeTruthy();
}

async function readMainOutline(page: Page): Promise<OutlineSnapshot> {
  return page.locator('main').evaluate((main) => {
    const style = window.getComputedStyle(main);
    return {
      boxShadow: style.boxShadow,
      focusRegionVisible: main.getAttribute('data-ofp-focus-region-visible'),
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
    };
  });
}

test.describe('layout focus regions', () => {
  test('does not show a main-content focus line after clicking empty space', async ({ page, request }, testInfo) => {
    const errors = trackConsoleErrors(page);
    await loginWithFreshProject(page, request, `focus-region-outline-${testInfo.workerIndex}`);

    for (const route of routes) {
      await page.goto(route.path);
      await waitForPageStable(page, route.ready);

      const main = page.locator('main');
      await expect(main).toBeVisible();
      const box = await main.boundingBox();
      expect(box).toBeTruthy();
      await main.click({
        position: {
          x: Math.max(1, Math.floor((box?.width ?? 2) - 2)),
          y: Math.max(1, Math.floor((box?.height ?? 2) - 2)),
        },
      });

      await expect.poll(() => readMainOutline(page)).toMatchObject({
        boxShadow: 'none',
        focusRegionVisible: null,
        outlineStyle: 'none',
      });
    }

    expect(errors).toEqual([]);
  });

  test('does not show a main-content focus line after a client-side route change', async ({ page, request }, testInfo) => {
    // Regression test: unlike the scenario above (which reloads via page.goto
    // for every route), the sidebar's <Link>-based navigation swaps the page
    // content without remounting the shared <main> region. If the previously
    // focused descendant unmounts as part of that swap, the browser can
    // implicitly move DOM focus back onto the (still mounted) <main>
    // container itself, which is exactly the case the CSS override in
    // theme.ts's MuiCssBaseline needs to suppress.
    const errors = trackConsoleErrors(page);
    await loginWithFreshProject(page, request, `focus-region-outline-nav-${testInfo.workerIndex}`);

    const first = routes[0];
    const second = routes[1];

    await page.goto(first.path);
    await waitForPageStable(page, first.ready);

    const main = page.locator('main');
    await expect(main).toBeVisible();
    const box = await main.boundingBox();
    expect(box).toBeTruthy();
    await main.click({
      position: {
        x: Math.max(1, Math.floor((box?.width ?? 2) - 2)),
        y: Math.max(1, Math.floor((box?.height ?? 2) - 2)),
      },
    });

    await page.locator(`a[href="${second.path}"]`).first().click();
    await waitForPageStable(page, second.ready);

    await expect.poll(() => readMainOutline(page)).toMatchObject({
      boxShadow: 'none',
      focusRegionVisible: null,
      outlineStyle: 'none',
    });

    expect(errors).toEqual([]);
  });
});
