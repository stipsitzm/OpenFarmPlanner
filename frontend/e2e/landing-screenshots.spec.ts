import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loginWithDeterministicProject, waitForPageStable } from './utils';

const viewport = { width: 1440, height: 900 };
const screenshotDir = path.resolve(process.cwd(), 'public/landing/screenshots');
const tempDir = path.resolve(process.cwd(), 'test-results/landing-screenshots');
const magickBinary = process.env.MAGICK_BINARY ?? 'magick';

const screenshots = [
  {
    key: 'areas',
    path: '/app/fields-beds',
    ready: /Hofgarten|Acker am Bach/i,
    filename: 'demo-areas.webp',
  },
  {
    key: 'calendar',
    path: '/app/gantt-chart?view=occupancy',
    ready: /Anbaukalender|Anbauflächen/i,
    filename: 'demo-calendar.webp',
  },
  {
    key: 'seed-demand',
    path: '/app/seed-demand',
    ready: /Saatgutbedarf|Karotte/i,
    filename: 'demo-seed-demand.webp',
  },
  {
    key: 'cultures',
    path: '/app/cultures',
    ready: /Kulturen|Karotte/i,
    filename: 'demo-cultures.webp',
  },
] as const;

async function disableTransientUi(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
}

function convertToWebp(sourcePng: string, targetWebp: string): void {
  execFileSync(magickBinary, [
    sourcePng,
    '-strip',
    '-resize',
    '1280x',
    '-quality',
    '82',
    targetWebp,
  ]);
}

// This is an asset-generation workflow, not a regression baseline test. It
// writes the landing-page screenshots used by HomePage from a deterministic
// demo project so product visuals can be refreshed after intentional UI work.
test.describe('landing page product screenshots', () => {
  test.skip(process.env.GENERATE_LANDING_SCREENSHOTS !== '1', 'Set GENERATE_LANDING_SCREENSHOTS=1 to refresh landing-page assets.');

  test('generates optimized demo screenshots', async ({ page, request }) => {
    try {
      execFileSync(magickBinary, ['-version'], { stdio: 'ignore' });
    } catch {
      test.skip(true, 'ImageMagick is required to convert screenshots to WebP.');
    }
    mkdirSync(screenshotDir, { recursive: true });
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });

    await page.setViewportSize(viewport);
    await loginWithDeterministicProject(page, request, 'landing-screenshots', {
      demoProject: true,
      loginAsAdmin: true,
    });
    await page.evaluate(() => {
      window.localStorage.setItem('fieldsBedsViewMode', 'table');
      window.localStorage.setItem('ofp.contextMenuHintDismissed', '1');
    });
    const currentUserId = await page.evaluate(async () => {
      const response = await fetch('/api/auth/me/', { credentials: 'include' });
      const payload = await response.json() as { id?: number };
      return payload.id ?? null;
    });
    if (currentUserId !== null) {
      await page.evaluate((userId) => {
        window.localStorage.setItem(`ofp.contextMenuHintDismissed:user:${userId}`, '1');
      }, currentUserId);
    }

    for (const item of screenshots) {
      await page.goto(item.path);
      await disableTransientUi(page);
      await waitForPageStable(page, item.ready);
      await page.mouse.move(0, 0);

      if (item.key === 'calendar') {
        await expect(page.locator('[data-testid="gantt-virtual-viewport"]')).toBeVisible();
        await page.locator('.gantt-container-wrapper .rmg-container').evaluate((element) => {
          element.scrollLeft = 0;
        });
      }

      const pngPath = path.join(tempDir, `${item.key}.png`);
      await page.screenshot({
        path: pngPath,
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
      });
      convertToWebp(pngPath, path.join(screenshotDir, item.filename));
    }
  });
});
