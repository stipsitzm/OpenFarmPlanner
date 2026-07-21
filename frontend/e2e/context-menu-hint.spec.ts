import { expect, test, type Page } from '@playwright/test';
import { loginWithDeterministicProject } from './utils';

const hintText = 'Tipp: Rechtsklick auf eine Tabellenzeile öffnet weitere Aktionen.';

async function getCurrentUserId(page: Page): Promise<number | null> {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/me/', { credentials: 'include' });
    const payload = await response.json() as { id?: number };
    return payload.id ?? null;
  });
}

async function seedLegacyDismissals(page: Page, userId: number | null): Promise<void> {
  await page.evaluate((currentUserId) => {
    window.localStorage.setItem('ofp.contextMenuHintDismissed', '1');
    if (currentUserId !== null) {
      window.localStorage.setItem(`ofp.contextMenuHintDismissed:user:${currentUserId}`, '1');
    }
  }, userId);
}

async function firstDataRow(page: Page) {
  const row = page.locator('[role="row"][data-id]').first();
  await expect(row).toBeVisible();
  return row;
}

test.describe('context menu hint dismissal', () => {
  test('stores row context-menu usage and manual dismissal per table context', async ({ page, request }) => {
    await loginWithDeterministicProject(page, request, 'context-menu-hint', {
      demoProject: true,
      loginAsAdmin: true,
    });
    const userId = await getCurrentUserId(page);
    await seedLegacyDismissals(page, userId);

    await page.goto('/app/anbauplaene');
    await expect(page.getByText(hintText)).toBeVisible();

    await (await firstDataRow(page)).click({ button: 'right', position: { x: 24, y: 18 } });
    await expect(page.getByText(hintText)).toBeHidden();

    const plantingPlansDismissed = await page.evaluate((currentUserId) => {
      if (currentUserId === null) {
        return window.localStorage.getItem('ofp.contextMenuHintDismissed:context:plantingPlans');
      }
      return window.localStorage.getItem(`ofp.contextMenuHintDismissed:user:${currentUserId}:context:plantingPlans`);
    }, userId);
    expect(plantingPlansDismissed).toBe('1');

    await page.goto('/app/fields-beds');
    const fieldsBedsHint = page.getByRole('note').filter({ hasText: hintText });
    await expect(fieldsBedsHint).toBeVisible();

    await fieldsBedsHint.getByRole('button', { name: 'Schließen' }).click();
    await expect(page.getByText(hintText)).toBeHidden();

    await page.reload();
    await expect(page.getByText(hintText)).toBeHidden();

    await page.goto('/app/suppliers');
    await expect(page.getByText(hintText)).toBeVisible();
  });
});
