import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { submitLoginFormAndAwaitApp } from './utils';

const backendPort = process.env.BACKEND_PORT ?? '8000';
const e2eToken = process.env.E2E_TEST_TOKEN || 'openfarmplanner-e2e-token';
const apiBase = `http://127.0.0.1:${backendPort}/api`;

type FieldsBedsFixture = {
  bedA: { id: number };
  bedB: { id: number };
  bedC: { id: number };
  bedD: { id: number };
};

type FocusedGridCell = {
  field: string | null;
  rowId: string | null;
  rowText: string;
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
  await submitLoginFormAndAwaitApp(page);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('activeProjectId'))).toBeTruthy();
}

async function postApi<T>(
  page: Page,
  path: string,
  data: Record<string, unknown>,
): Promise<T> {
  const projectId = await page.evaluate(() => window.localStorage.getItem('activeProjectId'));
  expect(projectId).toBeTruthy();
  const csrfToken = await page.evaluate(() =>
    document.cookie.split('; ').find((row) => row.startsWith('csrftoken='))?.split('=')[1] ?? '');

  const result = await page.evaluate(async ({ requestPath, requestData, requestProjectId, requestCsrfToken }) => {
    const response = await fetch(`/api${requestPath}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': requestCsrfToken,
        'X-Project-Id': requestProjectId,
      },
      body: JSON.stringify({ ...requestData, project: Number(requestProjectId) }),
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }, {
    requestPath: path,
    requestData: data,
    requestProjectId: projectId,
    requestCsrfToken: csrfToken,
  });

  expect(result.ok, `${path} -> ${result.status}: ${result.text}`).toBeTruthy();
  return JSON.parse(result.text) as T;
}

async function createFieldsBedsFixture(page: Page): Promise<FieldsBedsFixture> {
  const location = await postApi<{ id: number }>(page, '/locations/', { name: 'Keyboard Focus Standort' });
  const field = await postApi<{ id: number }>(page, '/fields/', {
    name: 'Keyboard Focus Parzelle',
    location: location.id,
  });

  const createBed = (name: string) => postApi<{ id: number }>(page, '/beds/', {
    name,
    field: field.id,
    length_m: 10,
    width_m: 1,
    area_sqm: 10,
  });

  return {
    bedA: await createBed('Keyboard Focus Beet A'),
    bedB: await createBed('Keyboard Focus Beet B'),
    bedC: await createBed('Keyboard Focus Beet C'),
    bedD: await createBed('Keyboard Focus Beet D'),
  };
}

async function readFocusedGridCell(page: Page): Promise<FocusedGridCell> {
  return page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    const cell = activeElement?.closest('[role="gridcell"]') as HTMLElement | null;
    const row = activeElement?.closest('[role="row"][data-id]') as HTMLElement | null;
    return {
      field: cell?.getAttribute('data-field') ?? null,
      rowId: row?.getAttribute('data-id') ?? null,
      rowText: row?.textContent ?? '',
    };
  });
}

async function expectFocusedCell(page: Page, rowId: number, text: string): Promise<void> {
  await expect.poll(() => readFocusedGridCell(page)).toMatchObject({
    field: 'name',
    rowId: String(rowId),
    rowText: expect.stringContaining(text),
  });
}

async function editBedNameWithEnter(page: Page, currentName: string, nextName: string): Promise<void> {
  const row = page.locator('[role="row"][data-id]').filter({ hasText: currentName }).first();
  await expect(row).toBeVisible();
  await row.locator('[data-field="name"]').click();

  const input = page.locator('.MuiDataGrid-row--editing [data-field="name"] input').first();
  await expect(input).toBeVisible();
  await input.fill(nextName);
  await input.press('Enter');

  await expect(page.locator('.MuiDataGrid-row--editing')).toHaveCount(0);
  await expect(page.locator('[role="row"][data-id]').filter({ hasText: nextName })).toBeVisible();
}

test.describe('fields-beds keyboard focus after Enter save', () => {
  test('keeps the first ArrowUp relative to the post-Enter focused bed', async ({ page, request }) => {
    const errors = trackConsoleErrors(page);
    await loginWithFreshProject(page, request, 'fields-keyboard-focus-up');
    const fixture = await createFieldsBedsFixture(page);

    await page.goto('/app/fields-beds');
    await expect(page.getByText('Keyboard Focus Beet D')).toBeVisible();

    await editBedNameWithEnter(page, 'Keyboard Focus Beet B', 'Keyboard Focus Beet B edited');
    await expectFocusedCell(page, fixture.bedC.id, 'Keyboard Focus Beet C');

    await page.keyboard.press('ArrowUp');
    await expectFocusedCell(page, fixture.bedB.id, 'Keyboard Focus Beet B edited');

    await page.keyboard.press('ArrowDown');
    await expectFocusedCell(page, fixture.bedC.id, 'Keyboard Focus Beet C');
    expect(errors).toEqual([]);
  });

  test('keeps the first ArrowDown relative to the post-Enter focused bed', async ({ page, request }) => {
    const errors = trackConsoleErrors(page);
    await loginWithFreshProject(page, request, 'fields-keyboard-focus-down');
    const fixture = await createFieldsBedsFixture(page);

    await page.goto('/app/fields-beds');
    await expect(page.getByText('Keyboard Focus Beet D')).toBeVisible();

    await editBedNameWithEnter(page, 'Keyboard Focus Beet B', 'Keyboard Focus Beet B edited');
    await expectFocusedCell(page, fixture.bedC.id, 'Keyboard Focus Beet C');

    await page.keyboard.press('ArrowDown');
    await expectFocusedCell(page, fixture.bedD.id, 'Keyboard Focus Beet D');
    expect(errors).toEqual([]);
  });
});
