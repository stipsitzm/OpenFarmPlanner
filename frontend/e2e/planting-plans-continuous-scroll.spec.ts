import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { loginWithDeterministicProject } from './utils';

const backendPort = process.env.BACKEND_PORT ?? '8000';
const apiBase = `http://127.0.0.1:${backendPort}/api`;

async function createPlantingPlanFixtures(
  page: Page,
  request: APIRequestContext,
  scenario: string,
  rowCount: number,
): Promise<void> {
  await loginWithDeterministicProject(page, request, scenario, { loginAsAdmin: true });

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

  const location = await api<{ id: number }>('/locations/', { name: 'Scrollhof' });
  const field = await api<{ id: number }>('/fields/', { name: 'Scrollfeld', location: location.id });
  const bed = await api<{ id: number }>('/beds/', { name: 'Scrollbeet', field: field.id, area_sqm: 10_000 });
  const culture = await api<{ id: number }>('/cultures/', {
    name: 'Scrollkultur',
    variety: 'Sorte A',
    propagation_duration_days: 21,
    cultivation_type: 'pre_cultivation',
    cultivation_types: ['pre_cultivation'],
    plants_per_m2: 4,
  });

  const batchSize = 20;
  for (let batchStart = 0; batchStart < rowCount; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, rowCount);
    await Promise.all(Array.from({ length: batchEnd - batchStart }, (_, offset) => {
      const index = batchStart + offset;
      const day = String((index % 28) + 1).padStart(2, '0');
      return api('/planting-plans/', {
        bed: bed.id,
        culture: culture.id,
        cultivation_type: 'pre_cultivation',
        planting_date: `2026-04-${day}`,
        harvest_date: `2026-05-${day}`,
        area_usage_sqm: 1,
      });
    }));
  }
}

async function getVirtualScrollerMetrics(page: Page, options: { attemptScroll?: boolean } = {}): Promise<{
  clientHeight: number;
  firstRenderedRowId: string | null;
  scrollHeight: number;
  scrollTopAfterScrollAttempt: number;
}> {
  const virtualScroller = page.locator('.MuiDataGrid-virtualScroller').first();
  await expect(virtualScroller).toBeVisible();

  return virtualScroller.evaluate(async (element, attemptScroll) => {
    if (attemptScroll) {
      element.scrollTop = 32;
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    return {
      clientHeight: element.clientHeight,
      firstRenderedRowId: element.querySelector('[role="row"][data-id]')?.getAttribute('data-id') ?? null,
      scrollHeight: element.scrollHeight,
      scrollTopAfterScrollAttempt: element.scrollTop,
    };
  }, Boolean(options.attemptScroll));
}

test.describe('planting plans continuous scroll', () => {
  test('does not leave a vertical scroll range when all rows fit', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await createPlantingPlanFixtures(page, request, 'planting-plans-short-scroll', 3);

    await page.goto('/app/planting-plans');
    await expect(page.getByText('Scrollkultur (Sorte A)').first()).toBeVisible({ timeout: 10_000 });

    const metrics = await getVirtualScrollerMetrics(page, { attemptScroll: true });
    expect(metrics.scrollHeight - metrics.clientHeight).toBeLessThanOrEqual(1);
    expect(metrics.scrollTopAfterScrollAttempt).toBe(0);
    await expect(page.getByTestId('continuous-scrollbar-thumb')).toHaveCount(0);
  });

  test('keeps the virtual scroller active when rows exceed the available height', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await createPlantingPlanFixtures(page, request, 'planting-plans-long-scroll', 120);

    await page.goto('/app/planting-plans');
    await expect(page.getByText('Scrollkultur (Sorte A)').first()).toBeVisible({ timeout: 10_000 });
    await page.evaluate(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const beforeScroll = await getVirtualScrollerMetrics(page);
    await expect(page.getByTestId('continuous-scrollbar-thumb')).toBeVisible();

    await page.locator('.MuiDataGrid-virtualScroller').first().hover();
    await page.mouse.wheel(0, 1400);

    await expect.poll(async () => {
      const afterScroll = await getVirtualScrollerMetrics(page);
      return afterScroll.scrollTopAfterScrollAttempt;
    }).toBeGreaterThan(beforeScroll.scrollTopAfterScrollAttempt);
  });
});
