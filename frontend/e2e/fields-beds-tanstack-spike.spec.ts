import { expect, test, type Page } from '@playwright/test';

import { loginWithDeterministicProject } from './utils';

async function getProjectContext(page: Page): Promise<{ projectId: number; csrfToken: string }> {
  const activeProjectId = await page.evaluate(() => window.localStorage.getItem('activeProjectId'));
  expect(activeProjectId).toBeTruthy();
  const csrfToken = await page.evaluate(() =>
    document.cookie.split('; ').find((row) => row.startsWith('csrftoken='))?.split('=')[1] ?? '');
  expect(csrfToken).toBeTruthy();
  return { projectId: Number(activeProjectId), csrfToken };
}

async function postApi<T>(
  page: Page,
  path: string,
  data: Record<string, unknown>,
): Promise<T> {
  const { projectId, csrfToken } = await getProjectContext(page);
  const result = await page.evaluate(async ({ requestPath, requestData, requestProjectId, requestCsrfToken }) => {
    const response = await fetch(`/api${requestPath}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': requestCsrfToken,
        'X-Project-Id': String(requestProjectId),
      },
      body: JSON.stringify({ ...requestData, project: requestProjectId }),
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

async function getApi<T>(page: Page, path: string): Promise<T> {
  const { projectId } = await getProjectContext(page);
  const result = await page.evaluate(async ({ requestPath, requestProjectId }) => {
    const response = await fetch(`/api${requestPath}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-Project-Id': String(requestProjectId) },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  }, {
    requestPath: path,
    requestProjectId: projectId,
  });

  expect(result.ok, `${path} -> ${result.status}: ${result.text}`).toBeTruthy();
  return JSON.parse(result.text) as T;
}

test.describe('fields-beds TanStack Table spike', () => {
  test('supports hierarchy, inline editing, sorting, filtering, keyboard, context menu, and responsive width', async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'tanstack-spike-small');
    await page.waitForLoadState('networkidle');
    const locations = await getApi<{ results: { id: number }[] }>(page, '/locations/');
    const location = locations.results[0];
    if (!location) {
      throw new Error('Expected the e2e fixture to provide a default location.');
    }
    const field = await postApi<{ id: number }>(page, '/fields/', {
      name: 'TanStack Testfeld',
      location: location.id,
      area_sqm: 24,
      length_m: 6,
      width_m: 4,
    });
    const bed = await postApi<{ id: number }>(page, '/beds/', {
      name: 'TanStack Testbeet',
      field: field.id,
      area_sqm: 6,
      length_m: 3,
      width_m: 2,
    });

    await page.evaluate(() => window.localStorage.setItem('fieldsBedsViewMode', 'table'));
    await page.goto('/app/fields-beds');
    const grid = page.getByTestId('tanstack-hierarchy-grid');
    await expect(grid).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('TanStack Testfeld')).toBeVisible();
    await expect(page.getByText('TanStack Testbeet')).toBeVisible();

    const fieldRow = page.getByTestId(`tanstack-row-field-${field.id}`);
    await fieldRow.getByRole('button', { name: 'Eintrag zuklappen' }).click();
    await expect(page.getByText('TanStack Testbeet')).not.toBeVisible();
    await fieldRow.getByRole('button', { name: 'Eintrag aufklappen' }).click();
    await expect(page.getByText('TanStack Testbeet')).toBeVisible();

    await fieldRow.dblclick();
    const editInput = fieldRow.getByRole('textbox').first();
    await expect(editInput).toBeVisible();
    await editInput.fill('TanStack Testfeld bearbeitet');
    await editInput.press('Enter');
    await expect(page.getByText('TanStack Testfeld bearbeitet')).toBeVisible({ timeout: 10_000 });

    await grid.focus();
    await page
      .getByTestId(`tanstack-row-${bed.id}`)
      .locator('[data-field="name"]')
      .click({ position: { x: 20, y: 10 } });
    await page.keyboard.press('ArrowUp');
    await expect(fieldRow).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId(`tanstack-row-${bed.id}`)).toHaveAttribute('aria-selected', 'true');

    const nameHeader = page.locator('[role="columnheader"][aria-sort]').first();
    await nameHeader.getByRole('button').first().click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    await page.getByRole('textbox').first().fill('Testbeet');
    await expect(page.getByText('TanStack Testbeet')).toBeVisible();
    await expect(page.getByText('TanStack Testfeld bearbeitet')).toBeVisible();
    await page.getByRole('textbox').first().fill('');

    await grid.focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: 'Anbauplan hinzufügen' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Zeile kopieren' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/fields-beds');
    await expect(grid).toBeVisible({ timeout: 10_000 });
    const fitsWithoutExtraHorizontalScroll = await grid.evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 2);
    expect(fitsWithoutExtraHorizontalScroll).toBe(true);
  });

  test('keeps a larger expanded hierarchy virtualized while scrolling', async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'tanstack-spike-large');
    await page.waitForLoadState('networkidle');
    const locations = await getApi<{ results: { id: number }[] }>(page, '/locations/');
    const location = locations.results[0];
    if (!location) {
      throw new Error('Expected the e2e fixture to provide a default location.');
    }
    const field = await postApi<{ id: number }>(page, '/fields/', {
      name: 'TanStack Large Feld',
      location: location.id,
      area_sqm: 1000,
      length_m: 100,
      width_m: 10,
    });

    for (let index = 0; index < 90; index += 1) {
      await postApi<{ id: number }>(page, '/beds/', {
        name: `TanStack Large Beet ${String(index + 1).padStart(3, '0')}`,
        field: field.id,
        area_sqm: 1,
        length_m: 1,
        width_m: 1,
      });
    }

    await page.evaluate(() => window.localStorage.setItem('fieldsBedsViewMode', 'table'));
    const start = Date.now();
    await page.goto('/app/fields-beds');
    const grid = page.getByTestId('tanstack-hierarchy-grid');
    await expect(grid).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('TanStack Large Beet 001')).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - start).toBeLessThan(10_000);

    const renderedRows = await page.locator('[data-testid^="tanstack-row-"]').count();
    expect(renderedRows).toBeLessThan(100);

    await grid.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await expect(page.getByText('TanStack Large Beet 090')).toBeVisible({ timeout: 10_000 });
  });
});
