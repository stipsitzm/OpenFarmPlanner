import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

const backendPort = process.env.BACKEND_PORT ?? '8000';
const e2eToken = process.env.E2E_TEST_TOKEN || 'openfarmplanner-e2e-token';
const apiBase = `http://127.0.0.1:${backendPort}/api`;

interface LoggedInApi {
  post: <T>(path: string, data: Record<string, unknown>) => Promise<T>;
}

async function loginWithAdmin(page: Page, request: APIRequestContext, scenario: string): Promise<LoggedInApi> {
  await request.post(`${apiBase}/__e2e__/invite-flow/`, {
    headers: { 'X-E2E-Token': e2eToken },
    data: { action: 'reset', scenario_id: scenario },
  });
  const setupResponse = await request.post(`${apiBase}/__e2e__/invite-flow/`, {
    headers: { 'X-E2E-Token': e2eToken },
    data: { action: 'setup', scenario_id: scenario, invitation_state: 'pending' },
  });
  const setup = await setupResponse.json() as { admin: { email: string; password: string } };

  await page.goto('/login');
  await page.getByLabel('E-Mail').fill(setup.admin.email);
  await page.locator('input[type="password"]').fill(setup.admin.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/app\//, { timeout: 10_000 });

  const activeProjectId = await page.evaluate(() => window.localStorage.getItem('activeProjectId'));
  expect(activeProjectId).toBeTruthy();
  const projectId = Number(activeProjectId);
  const csrfToken = await page.evaluate(() =>
    document.cookie.split('; ').find((row) => row.startsWith('csrftoken='))?.split('=')[1] ?? '');

  return {
    post: async <T,>(path: string, data: Record<string, unknown>): Promise<T> => {
      const response = await page.request.post(`${apiBase}${path}`, {
        headers: {
          'X-CSRFToken': csrfToken,
          'Content-Type': 'application/json',
          'X-Project-Id': String(projectId),
        },
        data: { ...data, project: projectId },
      });
      expect(response.ok(), `${path} -> ${response.status()}: ${await response.text()}`).toBeTruthy();
      return response.json() as Promise<T>;
    },
  };
}

test.describe('fields-beds AG Grid Community spike', () => {
  test('supports hierarchy navigation, inline editing, context menu, and responsive width', async ({ page, request }) => {
    const api = await loginWithAdmin(page, request, 'ag-grid-spike-small');
    const location = await api.post<{ id: number }>('/locations/', { name: 'AG Testhof' });
    const field = await api.post<{ id: number }>('/fields/', {
      name: 'AG Testfeld',
      location: location.id,
      area_sqm: 24,
      length_m: 6,
      width_m: 4,
    });
    await api.post<{ id: number }>('/beds/', {
      name: 'AG Testbeet',
      field: field.id,
      area_sqm: 6,
      length_m: 3,
      width_m: 2,
    });

    await page.goto('/app/fields-beds');
    await expect(page.getByRole('grid')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('AG Testhof')).toBeVisible();
    await expect(page.getByText('AG Testfeld')).toBeVisible();
    await expect(page.getByText('AG Testbeet')).toBeVisible();

    const fieldRow = page.locator('.ag-row').filter({ hasText: 'AG Testfeld' }).first();
    await fieldRow.getByRole('button').first().click();
    await expect(page.getByText('AG Testbeet')).not.toBeVisible();
    await fieldRow.getByRole('button').first().click();
    await expect(page.getByText('AG Testbeet')).toBeVisible();

    await fieldRow.locator('.ag-cell[col-id="name"]').dblclick();
    const editInput = page.locator('.ag-cell-inline-editing input').first();
    await expect(editInput).toBeVisible();
    await editInput.fill('AG Testfeld bearbeitet');
    await editInput.press('Enter');
    await expect(page.getByText('AG Testfeld bearbeitet')).toBeVisible({ timeout: 10_000 });

    const bedRow = page.locator('.ag-row').filter({ hasText: 'AG Testbeet' }).first();
    await bedRow.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Anbauplan hinzufügen' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Zeile kopieren' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/fields-beds');
    await expect(page.getByRole('grid')).toBeVisible({ timeout: 10_000 });
    const pageFitsViewport = await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
    expect(pageFitsViewport).toBe(true);
  });

  test('keeps a large expanded hierarchy virtualized', async ({ page, request }) => {
    const api = await loginWithAdmin(page, request, 'ag-grid-spike-large');
    const location = await api.post<{ id: number }>('/locations/', { name: 'AG Large Hof' });
    const field = await api.post<{ id: number }>('/fields/', {
      name: 'AG Large Feld',
      location: location.id,
      area_sqm: 1000,
      length_m: 100,
      width_m: 10,
    });

    for (let index = 0; index < 120; index += 1) {
      await api.post<{ id: number }>('/beds/', {
        name: `AG Large Beet ${String(index + 1).padStart(3, '0')}`,
        field: field.id,
        area_sqm: 1,
        length_m: 1,
        width_m: 1,
      });
    }

    const start = Date.now();
    await page.goto('/app/fields-beds');
    await expect(page.getByRole('grid')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('AG Large Beet 001')).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - start).toBeLessThan(10_000);

    const renderedRows = await page.locator('.ag-center-cols-container .ag-row').count();
    expect(renderedRows).toBeLessThan(80);

    await expect(page.getByText('AG Large Beet 120')).not.toBeVisible();
  });
});
