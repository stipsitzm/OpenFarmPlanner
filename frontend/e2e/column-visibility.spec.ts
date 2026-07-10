import { expect, test } from '@playwright/test';

// Must match playwright.config.ts's webServer default, or this hits whatever
// else happens to be running on port 8000 (e.g. a developer's own dev backend)
// instead of the backend actually under test.
const backendPort = process.env.BACKEND_PORT ?? '8000';
const e2eToken = process.env.E2E_TEST_TOKEN || 'openfarmplanner-e2e-token';
const apiBase = `http://127.0.0.1:${backendPort}/api`;

test.describe('planting plans column management', () => {
  test('native columns panel toggles a column, autofit stays available, and choices persist', async ({ page, request }) => {
    const scenario = 'column-visibility-1';

    await request.post(`${apiBase}/__e2e__/invite-flow/`, {
      headers: { 'X-E2E-Token': e2eToken },
      data: { action: 'reset', scenario_id: scenario },
    });
    const setupResponse = await request.post(`${apiBase}/__e2e__/invite-flow/`, {
      headers: { 'X-E2E-Token': e2eToken },
      data: { action: 'setup', scenario_id: scenario, invitation_state: 'pending' },
    });
    const setup = await setupResponse.json() as { admin: { email: string; password: string }; projectSlug: string };

    await page.goto('/login');
    await page.getByLabel('E-Mail').fill(setup.admin.email);
    await page.locator('input[type="password"]').fill(setup.admin.password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/app\//, { timeout: 10_000 });

    const activeProjectId = await page.evaluate(() => window.localStorage.getItem('activeProjectId'));
    const projectId = Number(activeProjectId);

    const csrfToken = await page.evaluate(() =>
      document.cookie.split('; ').find((row) => row.startsWith('csrftoken='))?.split('=')[1] ?? '');

    const api = async <T,>(path: string, data: Record<string, unknown>): Promise<T> => {
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
    };

    const location = await api<{ id: number }>('/locations/', { name: 'Testhof' });
    const field = await api<{ id: number }>('/fields/', { name: 'Testfeld', location: location.id });
    const bed = await api<{ id: number }>('/beds/', { name: 'Testbeet', field: field.id, area_sqm: 5 });
    const culture = await api<{ id: number }>('/cultures/', {
      name: 'Testkultur',
      variety: 'Sorte A',
      propagation_duration_days: 21,
      cultivation_type: 'pre_cultivation',
      cultivation_types: ['pre_cultivation'],
      plants_per_m2: 4,
    });
    await api('/planting-plans/', {
      bed: bed.id,
      culture: culture.id,
      cultivation_type: 'pre_cultivation',
      planting_date: '2026-04-01',
      harvest_date: '2026-05-01',
      area_usage_sqm: 2,
    });

    await page.goto('/app/planting-plans');
    await expect(page.getByText('Testkultur (Sorte A)').first()).toBeVisible({ timeout: 10_000 });

    // The native columns button (replacing the old bespoke checkbox-menu) opens
    // MUI's built-in columns panel.
    const columnsButton = page.getByRole('button', { name: 'Spalten ein-/ausblenden' });
    await expect(columnsButton).toBeVisible();
    await columnsButton.click();

    // The Autofit toggle has no native MUI equivalent and is a custom addition
    // living next to the native trigger.
    const autofitCheckbox = page.getByRole('checkbox', { name: 'Automatisch an Bildschirmbreite anpassen' });
    await expect(autofitCheckbox).toBeVisible({ timeout: 5_000 });

    const notesColumnCheckbox = page.getByRole('checkbox', { name: 'Notizen' });
    await expect(notesColumnCheckbox).toBeVisible({ timeout: 5_000 });
    await expect(notesColumnCheckbox).toBeChecked();
    await notesColumnCheckbox.uncheck();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Notizen' })).toHaveCount(0, { timeout: 5_000 });

    // Persistence: the manual choice survives a reload (localStorage-backed,
    // unchanged from before this migration).
    await page.reload();
    await expect(page.getByText('Testkultur (Sorte A)').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Notizen' })).toHaveCount(0);

    const storedState = await page.evaluate(() => window.localStorage.getItem('tableColumns.plantingPlans'));
    expect(storedState).toBeTruthy();
    const parsedState = JSON.parse(storedState ?? '{}') as { autofit: boolean; model: Record<string, boolean> };
    expect(parsedState.autofit).toBe(false);
    expect(parsedState.model.notes).toBe(false);
  });
});
