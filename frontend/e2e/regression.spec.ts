import { expect, test } from '@playwright/test';
import {
  loginAndSeed,
  loginWithDeterministicProject,
  setViewportPreset,
  VIEWPORTS,
  waitForPageStable,
} from './utils';

// ---------------------------------------------------------------------------
// Cultures CRUD
// ---------------------------------------------------------------------------

test.describe('cultures CRUD', () => {
  test.beforeEach(async ({ page, request }, testInfo) => {
    await loginWithDeterministicProject(page, request, `cult-crud-${testInfo.workerIndex}`);
  });

  test('creates a new culture via the form', async ({ page }) => {
    await page.goto('/app/cultures');
    await waitForPageStable(page, /Kulturen/i);

    await page.getByRole('button', { name: /Kultur hinzufügen/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const nameField = page.getByRole('textbox', { name: /^Name$/i });
    await nameField.fill('Testkultur Playwright');
    await page.getByRole('button', { name: /^Erstellen$/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Testkultur Playwright')).toBeVisible();
  });

  test('cancels culture creation with Abbrechen', async ({ page }) => {
    await page.goto('/app/cultures');
    await waitForPageStable(page, /Kulturen/i);

    await page.getByRole('button', { name: /Kultur hinzufügen/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /Abbrechen/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fields/Beds CRUD and keyboard editing
// ---------------------------------------------------------------------------

test.describe('fields and beds keyboard editing', () => {
  test.beforeEach(async ({ page, request }, testInfo) => {
    await loginAndSeed(page, request, `kbd-${testInfo.workerIndex}`);
    await page.goto('/app/fields-beds');
    await waitForPageStable(page, /Anbauflächen|Parzellen|Beete/i);
  });

  test('Enter saves an inline edit on a bed row', async ({ page }) => {
    // Find the bed name cell and click to start editing.
    const bedCell = page.getByText('E2E Beet').first();
    await expect(bedCell).toBeVisible();
    await bedCell.dblclick();

    const input = page.locator('[role="row"][data-id] input[type="text"]').first();
    await expect(input).toBeVisible();

    await input.fill('E2E Beet geändert');
    await input.press('Enter');

    // After Enter, the input should be gone and the new name visible.
    await expect(input).not.toBeVisible();
    await expect(page.getByText('E2E Beet geändert')).toBeVisible();
  });

  test('Escape cancels an inline edit without saving', async ({ page }) => {
    const bedCell = page.getByText('E2E Beet').first();
    await expect(bedCell).toBeVisible();
    await bedCell.dblclick();

    const input = page.locator('[role="row"][data-id] input[type="text"]').first();
    await expect(input).toBeVisible();
    const originalValue = await input.inputValue();

    await input.fill('Wird nicht gespeichert');
    await input.press('Escape');

    await expect(input).not.toBeVisible();
    await expect(page.getByText(originalValue)).toBeVisible();
    await expect(page.getByText('Wird nicht gespeichert')).not.toBeVisible();
  });

  test('adding a new parcel via the toolbar button', async ({ page }) => {
    // The "Parzelle" add button is in the toolbar area.
    const addParcelButton = page.getByRole('button', { name: /Parzelle/i }).first();
    await addParcelButton.click();

    // A dialog for naming the new parcel should appear.
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('textbox', { name: /Name der Parzelle/i }).fill('Neue E2E Parzelle');
    await page.getByRole('button', { name: /Hinzufügen/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Neue E2E Parzelle')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Context menu behavior
// ---------------------------------------------------------------------------

test.describe('context menu', () => {
  test.beforeEach(async ({ page, request }, testInfo) => {
    await loginAndSeed(page, request, `ctx-${testInfo.workerIndex}`);
    await page.goto('/app/fields-beds');
    await waitForPageStable(page, /Anbauflächen|Parzellen|Beete/i);
  });

  test('right-click opens the application context menu on a row', async ({ page }) => {
    const nameCell = page.getByText('E2E Parzelle').first();
    await expect(nameCell).toBeVisible();

    await nameCell.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
  });

  test('Escape closes the context menu', async ({ page }) => {
    const nameCell = page.getByText('E2E Parzelle').first();
    await expect(nameCell).toBeVisible();

    await nameCell.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).not.toBeVisible();
  });

  test('context menu delete action removes the item', async ({ page }) => {
    const nameCell = page.getByText('E2E Beet').first();
    await expect(nameCell).toBeVisible();

    await nameCell.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();

    // Click the delete menu item.
    await page.getByRole('menuitem', { name: /Löschen/i }).click();
    await expect(page.getByRole('menu')).not.toBeVisible();

    // A snackbar with undo should appear.
    await expect(page.getByRole('alert').filter({ hasText: /Rückgängig/i }).or(
      page.getByText(/gelöscht/i)
    )).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Notes drawer
// ---------------------------------------------------------------------------

test.describe('notes drawer', () => {
  test.beforeEach(async ({ page, request }, testInfo) => {
    await loginAndSeed(page, request, `notes-${testInfo.workerIndex}`);
    await page.goto('/app/fields-beds');
    await waitForPageStable(page, /Anbauflächen|Parzellen|Beete/i);
  });

  test('opening notes focuses the text field', async ({ page }) => {
    // Click the notes cell in the bed row.
    const notesCell = page.locator('[role="row"]').filter({ hasText: 'E2E Beet' })
      .locator('[data-field="notes"]');
    await expect(notesCell).toBeVisible();
    await notesCell.click();

    // The notes drawer/panel should open and the textarea should be focused.
    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeFocused();
  });

  test('saving notes persists the content', async ({ page }) => {
    const notesCell = page.locator('[role="row"]').filter({ hasText: 'E2E Beet' })
      .locator('[data-field="notes"]');
    await notesCell.click();

    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible();

    await textarea.fill('Playwright Notiz');
    await page.getByRole('button', { name: /Speichern/i }).last().click();

    // Drawer closes after save.
    await expect(textarea).not.toBeVisible();

    // Reopen to confirm persistence.
    await notesCell.click();
    const reopenedTextarea = page.locator('textarea').last();
    await expect(reopenedTextarea).toHaveValue('Playwright Notiz');
  });

  test('Escape closes the notes drawer without saving', async ({ page }) => {
    const notesCell = page.locator('[role="row"]').filter({ hasText: 'E2E Beet' })
      .locator('[data-field="notes"]');
    await notesCell.click();

    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible();
    await textarea.fill('Wird verworfen');
    await page.keyboard.press('Escape');

    // Drawer should close (possibly with a confirm dialog for unsaved changes).
    // Confirm discard if a dialog appears.
    const discardButton = page.getByRole('button', { name: /Verwerfen/i });
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    await expect(textarea).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Mobile smoke tests
// ---------------------------------------------------------------------------

test.describe('mobile smoke', () => {
  const mobile = VIEWPORTS.find((v) => v.key === 'mobile')!;

  test.beforeEach(async ({ page, request }, testInfo) => {
    await loginWithDeterministicProject(page, request, `mob-${testInfo.workerIndex}`);
    await setViewportPreset(page, mobile);
  });

  test('main navigation works at mobile viewport', async ({ page }) => {
    await page.goto('/app/cultures');
    await waitForPageStable(page, /Kulturen/i);

    await page.goto('/app/fields-beds');
    await waitForPageStable(page, /Anbauflächen|Parzellen|Beete/i);

    await page.goto('/app/anbauplaene');
    await waitForPageStable(page, /Anbaupläne|Anbauplan/i);
  });

  test('topbar is visible and single-line at mobile viewport', async ({ page }) => {
    await page.goto('/app/cultures');
    await waitForPageStable(page, /Kulturen/i);

    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Verify the topbar does not exceed one row height (< 80px is a single line).
    const box = await header.boundingBox();
    expect(box?.height).toBeLessThan(80);
  });
});
