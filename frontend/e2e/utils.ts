import { expect, type APIRequestContext, type Page } from '@playwright/test';

const e2eApiBase = process.env.PLAYWRIGHT_E2E_API_BASE ?? 'http://127.0.0.1:8000/api/__e2e__/invite-flow/';
const e2eToken = process.env.E2E_TEST_TOKEN || 'openfarmplanner-e2e-token';

export const VIEWPORTS = [
  { key: 'mobile', width: 375, height: 800 },
  { key: 'tablet', width: 768, height: 900 },
  { key: 'small-desktop', width: 1024, height: 900 },
  { key: 'desktop', width: 1440, height: 900 },
] as const;

export const MAIN_ROUTES = [
  { key: 'dashboard', path: '/app/dashboard', ready: /Übersicht|Dashboard/i },
  { key: 'anbauflaechen', path: '/app/fields-beds', ready: /Anbauflächen|Parzellen|Beete/i },
  { key: 'kulturen', path: '/app/cultures', ready: /Kulturen/i },
  { key: 'anbauplaene', path: '/app/anbauplaene', ready: /Anbaupläne|Anbauplan/i },
  { key: 'anbaukalender', path: '/app/gantt-chart', ready: /Anbaukalender|Kalender/i },
  { key: 'ertragsuebersicht', path: '/app/yield-overview', ready: /Ertragsübersicht|Ertragsverteilung|Ertragsprognose/i },
  { key: 'saatgutbedarf', path: '/app/seed-demand', ready: /Saatgutbedarf/i },
  { key: 'lieferanten', path: '/app/suppliers', ready: /Lieferanten/i },
] as const;

async function invokeE2EAction(request: APIRequestContext, action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await request.post(e2eApiBase, {
    headers: { 'X-E2E-Token': e2eToken },
    data: { action, ...payload },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Record<string, unknown>;
}

export async function loginWithDeterministicProject(page: Page, request: APIRequestContext, scenarioId: string): Promise<void> {
  await invokeE2EAction(request, 'reset', { scenario_id: scenarioId });
  const fixture = await invokeE2EAction(request, 'setup', { scenario_id: scenarioId, invitation_state: 'pending' }) as {
    inviteUrl: string;
    invitee: { email: string; password: string };
  };

  await page.goto(fixture.inviteUrl);
  await page.getByLabel('E-Mail').fill(fixture.invitee.email);
  await page.getByLabel('Passwort').fill(fixture.invitee.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/app\//);
}

export async function setViewportPreset(page: Page, preset: (typeof VIEWPORTS)[number]): Promise<void> {
  await page.setViewportSize({ width: preset.width, height: preset.height });
}

export async function waitForPageStable(page: Page, readyPattern?: RegExp): Promise<void> {
  await page.waitForLoadState('networkidle');
  if (readyPattern) {
    await expect(page.getByText(readyPattern).first()).toBeVisible();
  }
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
}
